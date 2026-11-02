# Clima de la semana

App web que consulta el clima actual y el pronóstico de 7 días de cualquier ciudad.
Usa la API gratuita de [Open-Meteo](https://open-meteo.com/) (geocodificación + pronóstico).

## Qué hace

- Busca una ciudad por nombre y, si hay varias con el mismo nombre, deja elegir.
- Muestra temperatura actual, sensación térmica, humedad, viento y pronóstico de 7 días con íconos.
- El fondo cambia según el clima y si es de día o de noche (despejado, nublado, lluvia, tormenta).
- Permite cambiar entre °C y °F sin volver a consultar la API.
- Maneja errores: sin conexión, tiempo de espera agotado, límite de peticiones (HTTP 429),
  fallas del servidor, ciudad sin resultados y respuestas sin datos.

## Cómo ejecutarla

No necesita instalar nada ni configurar claves: Open-Meteo no requiere API key para uso no comercial.

1. Clona el repositorio:
   ```bash
   git clone <URL-DE-TU-REPOSITORIO>
   cd clima-app
   ```
2. Abre `index.html` en el navegador, o levanta un servidor local:
   ```bash
   python3 -m http.server 8000
   ```
   y entra a http://localhost:8000

## Atribución

Los datos son de [Open-Meteo.com](https://open-meteo.com/) bajo licencia CC BY 4.0; la app muestra el crédito en el pie de página.
La versión gratuita es solo para uso no comercial.

## Claves de API

Esta app no usa clave. Si en el futuro se cambia a una API con clave, debe guardarse en un
archivo `.env` (ya incluido en `.gitignore`) y nunca subirse al repositorio.

## Estructura

```
clima-app/
├── index.html            Estructura de la página
├── src/
│   ├── css/styles.css    Estilos (claro y oscuro)
│   └── js/app.js         Peticiones a la API, manejo de errores y render
├── docs/
│   └── BITACORA_IA.md    Bitácora de programación con IA
├── .gitignore            Excluye .env y archivos locales
└── README.md
```

## Declaración de uso de IA

> Completa y corrige esta sección con lo que realmente hiciste. Debe ser fiel a tu proceso.

**Herramientas de IA usadas**

| Herramienta | Para qué la usé |
|---|---|
| Claude | Generar la primera versión del código (HTML, CSS, JS) y este README |


**Qué hice yo sin ayuda de IA**

-  cambios de diseño, pruebas manuales de errores, commits, despliegue, la demostración]

## Autor

carlos alejandro
