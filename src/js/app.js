// App del clima: consume la API de Open-Meteo (no requiere clave).
// Geocodificación: busca una ciudad y devuelve coordenadas.
// Pronóstico: con las coordenadas devuelve clima actual y 7 días.

const GEO_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const TIMEOUT_MS = 10000;

// Descripciones de los códigos WMO que devuelve la API
const WEATHER_CODES = {
  0: "Despejado", 1: "Mayormente despejado", 2: "Parcialmente nublado", 3: "Nublado",
  45: "Niebla", 48: "Niebla con escarcha",
  51: "Llovizna ligera", 53: "Llovizna", 55: "Llovizna intensa",
  61: "Lluvia ligera", 63: "Lluvia", 65: "Lluvia fuerte",
  71: "Nieve ligera", 73: "Nieve", 75: "Nieve fuerte",
  80: "Chubascos ligeros", 81: "Chubascos", 82: "Chubascos fuertes",
  95: "Tormenta", 96: "Tormenta con granizo", 99: "Tormenta fuerte con granizo",
};

// ---------- Íconos (SVG fijo, sin datos del usuario) ----------

const SUN_RAYS = '<path d="M24 5v6M24 37v6M5 24h6M37 24h6M10.6 10.6l4.2 4.2M33.2 33.2l4.2 4.2M10.6 37.4l4.2-4.2M33.2 14.8l4.2-4.2"/>';
const CLOUD = (dy = 0) =>
  `<g fill="var(--nube)" transform="translate(0 ${dy})"><circle cx="17" cy="30" r="8"/><circle cx="28" cy="24" r="10"/><circle cx="36" cy="31" r="7"/><rect x="14" y="30" width="26" height="8"/></g>`;

const ICONS = {
  sol: `<circle cx="24" cy="24" r="9" fill="var(--sol)"/><g stroke="var(--sol)" stroke-width="3" stroke-linecap="round">${SUN_RAYS}</g>`,
  luna: '<path d="M30 7a17 17 0 1 0 11 29A14 14 0 0 1 30 7z" fill="var(--luna)"/>',
  parcial: (dia) =>
    (dia
      ? '<circle cx="17" cy="16" r="7" fill="var(--sol)"/><g stroke="var(--sol)" stroke-width="2.5" stroke-linecap="round"><path d="M17 3v3M4 16h3M7.8 6.8l2 2M26.2 6.8l-2 2"/></g>'
      : '<path d="M20 5a10 10 0 1 0 8 16A8 8 0 0 1 20 5z" fill="var(--luna)"/>') + CLOUD(2),
  nube: CLOUD(),
  niebla: CLOUD(-4) + '<g stroke="var(--nube)" stroke-width="3" stroke-linecap="round"><path d="M10 38h28M14 44h20"/></g>',
  lluvia: CLOUD(-5) + '<g stroke="var(--lluvia)" stroke-width="3" stroke-linecap="round"><path d="M17 38l-2 6M26 38l-2 6M35 38l-2 6"/></g>',
  nieve: CLOUD(-5) + '<g fill="var(--nube)"><circle cx="17" cy="41" r="2"/><circle cx="26" cy="43" r="2"/><circle cx="35" cy="41" r="2"/></g>',
  tormenta: CLOUD(-6) + '<path d="M26 30l-7 10h5l-2 8 9-12h-5l3-6z" fill="var(--sol)"/>',
};

// Devuelve el ícono (como texto SVG) y el tema visual según el código WMO
function visualFor(code, isDay) {
  let key = "nube";
  let theme = "nublado";
  if (code === 0 || code === 1) { key = isDay ? "sol" : "luna"; theme = isDay ? "dia" : "noche"; }
  else if (code === 2) { key = "parcial"; theme = isDay ? "dia" : "noche"; }
  else if (code === 45 || code === 48) { key = "niebla"; }
  else if ((code >= 51 && code <= 65) || (code >= 80 && code <= 82)) { key = "lluvia"; theme = "lluvia"; }
  else if (code >= 71 && code <= 75) { key = "nieve"; }
  else if (code >= 95) { key = "tormenta"; theme = "tormenta"; }

  const body = typeof ICONS[key] === "function" ? ICONS[key](isDay) : ICONS[key];
  return { svg: `<svg viewBox="0 0 48 48" aria-hidden="true">${body}</svg>`, theme };
}

// ---------- Estado ----------

const state = {
  unit: "C",      // "C" o "F"
  place: null,    // última ciudad mostrada
  data: null,     // última respuesta del pronóstico
};

const $ = (id) => document.getElementById(id);
const els = {
  form: $("search-form"), input: $("city-input"), status: $("status"), matches: $("matches"),
  current: $("current"), forecast: $("forecast"), days: $("days"), toggle: $("unit-toggle"),
};

// Convierte de Celsius a la unidad elegida y redondea
function deg(celsius) {
  const value = state.unit === "F" ? (celsius * 9) / 5 + 32 : celsius;
  return Math.round(value);
}

// ---------- Errores ----------

// Un error propio con un "tipo" para mostrar un mensaje claro al usuario
class AppError extends Error {
  constructor(kind, message) {
    super(message);
    this.kind = kind;
  }
}

const ERROR_MESSAGES = {
  offline: "No hay conexión a internet. Revisa tu red e inténtalo de nuevo.",
  timeout: "La consulta tardó demasiado. Inténtalo de nuevo en unos segundos.",
  "rate-limit": "Se hicieron demasiadas consultas. Espera un minuto y vuelve a intentarlo.",
  server: "El servicio del clima no está disponible por ahora. Inténtalo más tarde.",
  empty: "No encontramos resultados. Revisa el nombre de la ciudad.",
  "no-data": "El servicio respondió sin datos del clima para este lugar.",
};

// ---------- Peticiones ----------

async function fetchJson(url) {
  if (!navigator.onLine) throw new AppError("offline");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (res.status === 429) throw new AppError("rate-limit");
    if (!res.ok) throw new AppError("server");
    return await res.json();
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err.name === "AbortError") throw new AppError("timeout");
    // fetch lanza TypeError cuando falla la red
    throw new AppError("offline");
  } finally {
    clearTimeout(timer);
  }
}

async function searchCities(name) {
  const params = new URLSearchParams({ name, count: "5", language: "es", format: "json" });
  const data = await fetchJson(`${GEO_URL}?${params}`);
  // Si no hay coincidencias, la API omite la propiedad "results"
  if (!data.results || data.results.length === 0) throw new AppError("empty");
  return data.results;
}

async function getForecast(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,weather_code,is_day",
    daily: "weather_code,temperature_2m_max,temperature_2m_min",
    timezone: "auto",
    forecast_days: "7",
  });
  const data = await fetchJson(`${FORECAST_URL}?${params}`);
  if (!data.current || !data.daily || !data.daily.time || data.daily.time.length === 0) {
    throw new AppError("no-data");
  }
  return data;
}

// ---------- Interfaz ----------

function showStatus(text, isError = false) {
  els.status.textContent = text;
  els.status.classList.toggle("error", isError);
  els.status.hidden = false;
}

function hideStatus() {
  els.status.hidden = true;
}

function showError(err) {
  const message = err instanceof AppError ? ERROR_MESSAGES[err.kind] : "Ocurrió un error inesperado.";
  showStatus(message, true);
  if (!(err instanceof AppError)) console.error(err);
}

function describe(code) {
  return WEATHER_CODES[code] || "Sin descripción";
}

function placeLabel(place) {
  return [place.name, place.admin1, place.country].filter(Boolean).join(", ");
}

function renderCurrent(place, data) {
  const c = data.current;
  const todayMax = data.daily.temperature_2m_max[0];
  const todayMin = data.daily.temperature_2m_min[0];
  const visual = visualFor(c.weather_code, c.is_day === 1);

  document.body.dataset.theme = visual.theme;
  $("place").textContent = placeLabel(place);
  $("temp").textContent = deg(c.temperature_2m);
  $("unit-label").textContent = `°${state.unit}`;
  $("icon").innerHTML = visual.svg; // SVG fijo definido arriba, no viene de la API
  $("condition").textContent = describe(c.weather_code);
  $("feels").textContent = `${deg(c.apparent_temperature)}°`;
  $("today").textContent = `${deg(todayMax)}° / ${deg(todayMin)}°`;
  $("humidity").textContent = `${c.relative_humidity_2m} %`;
  $("wind").textContent = `${Math.round(c.wind_speed_10m)} km/h`;

  // Reinicia la animación de entrada cada vez que se carga una ciudad
  els.current.hidden = false;
  els.current.style.animation = "none";
  void els.current.offsetWidth;
  els.current.style.animation = "";
}

function renderForecast(data) {
  const d = data.daily;
  // Escala común (en °C) para que las barras de todos los días sean comparables
  const min = Math.min(...d.temperature_2m_min);
  const max = Math.max(...d.temperature_2m_max);
  const span = max - min || 1;

  els.days.replaceChildren();
  d.time.forEach((date, i) => {
    const li = document.createElement("li");
    li.className = "day";

    const icon = document.createElement("div");
    icon.className = "day-icon";
    icon.innerHTML = visualFor(d.weather_code[i], true).svg; // SVG fijo

    const name = document.createElement("div");
    const dayName = document.createElement("div");
    dayName.className = "day-name";
    // Se agrega T12:00 para evitar que la zona horaria cambie el día
    dayName.textContent = i === 0 ? "Hoy" : new Date(`${date}T12:00:00`).toLocaleDateString("es-MX", { weekday: "short" }).replace(".", "");
    const desc = document.createElement("div");
    desc.className = "day-desc";
    desc.textContent = describe(d.weather_code[i]);
    name.append(dayName, desc);

    const range = document.createElement("div");
    range.className = "range";
    const bar = document.createElement("span");
    bar.style.left = `${((d.temperature_2m_min[i] - min) / span) * 100}%`;
    bar.style.right = `${((max - d.temperature_2m_max[i]) / span) * 100}%`;
    range.append(bar);

    const temps = document.createElement("div");
    temps.className = "day-temps";
    temps.textContent = `${deg(d.temperature_2m_max[i])}° `;
    const low = document.createElement("small");
    low.textContent = `${deg(d.temperature_2m_min[i])}°`;
    temps.append(low);

    li.append(icon, name, range, temps);
    els.days.append(li);
  });
  els.forecast.hidden = false;
}

async function loadPlace(place) {
  els.matches.hidden = true;
  showStatus("Cargando clima...");
  try {
    const data = await getForecast(place.latitude, place.longitude);
    state.place = place;
    state.data = data;
    hideStatus();
    renderCurrent(place, data);
    renderForecast(data);
  } catch (err) {
    els.current.hidden = true;
    els.forecast.hidden = true;
    showError(err);
  }
}

function renderMatches(places) {
  els.matches.replaceChildren();
  places.forEach((place) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = placeLabel(place);
    btn.addEventListener("click", () => loadPlace(place));
    li.append(btn);
    els.matches.append(li);
  });
  els.matches.hidden = false;
}

async function handleSearch(name) {
  showStatus("Buscando ciudad...");
  els.matches.hidden = true;
  try {
    const places = await searchCities(name.trim());
    if (places.length === 1) {
      await loadPlace(places[0]);
    } else {
      hideStatus();
      els.current.hidden = true;
      els.forecast.hidden = true;
      renderMatches(places);
    }
  } catch (err) {
    els.current.hidden = true;
    els.forecast.hidden = true;
    showError(err);
  }
}

els.form.addEventListener("submit", (event) => {
  event.preventDefault();
  handleSearch(els.input.value);
});

// Cambia entre °C y °F sin volver a pedir datos a la API
els.toggle.addEventListener("click", () => {
  state.unit = state.unit === "C" ? "F" : "C";
  els.toggle.textContent = `°${state.unit}`;
  els.toggle.setAttribute("aria-pressed", String(state.unit === "F"));
  if (state.place && state.data) {
    renderCurrent(state.place, state.data);
    renderForecast(state.data);
  }
});

// Al abrir la app se muestra Mérida, Yucatán por defecto (coordenadas fijas
// porque buscar "Mérida" devuelve varias ciudades con ese nombre)
loadPlace({ name: "Mérida", admin1: "Yucatán", country: "México", latitude: 20.9674, longitude: -89.5926 });
