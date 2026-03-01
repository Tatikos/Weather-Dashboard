/* ================================================================
   js/api/weather.js
   Fetches current weather from OpenWeatherMap and updates
   the "Right Now" tab DOM elements.
   ================================================================ */

import { OWM_KEY } from '../config.js';
import { formatTime } from '../helpers.js';

/**
 * Fetch current weather for a given coordinate and populate
 * all Right Now tab fields.
 * Also calculates dew point (Magnus approximation) and writes
 * it to the air quality card — it is more accurate than AQICN's
 * dew value for the user's exact location.
 *
 * @param {number} lat
 * @param {number} lon
 */
export async function fetchWeather(lat, lon) {
  const url =
    `https://api.openweathermap.org/data/2.5/weather` +
    `?lat=${lat}&lon=${lon}&appid=${OWM_KEY}&units=metric`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Weather API responded ${res.status}`);
    const data = await res.json();

    // ── Temperatures ──
    const temp    = Math.round(data.main.temp);
    const tempMin = Math.round(data.main.temp_min);
    const tempMax = Math.round(data.main.temp_max);

    // ── Dew point (Magnus approximation) ──
    const t     = data.main.temp;
    const rh    = data.main.humidity;
    const alpha = ((17.27 * t) / (237.7 + t)) + Math.log(rh / 100.0);
    const dew   = Math.round((237.7 * alpha) / (17.27 - alpha));

    // ── DOM updates ──
    document.getElementById('weather-temp-val').textContent    = temp;
    document.getElementById('w-temp-min').textContent          = `L:${tempMin}°C`;
    document.getElementById('w-temp-max').textContent          = `H:${tempMax}°C`;
    document.getElementById('weather-description').textContent = data.weather[0].description;
    document.getElementById('weather-icon').src =
      `https://openweathermap.org/img/wn/${data.weather[0].icon}@4x.png`;

    document.getElementById('w-pressure').textContent = `${data.main.pressure} hPa`;
    document.getElementById('w-humidity').textContent = `${data.main.humidity}%`;
    document.getElementById('w-wind').textContent     = `${data.wind.speed} m/s`;
    document.getElementById('w-clouds').textContent   = `${data.clouds.all}%`;
    document.getElementById('w-sunrise').textContent  = formatTime(data.sys.sunrise);
    document.getElementById('w-sunset').textContent   = formatTime(data.sys.sunset);

    // Dew — written here; AQICN only overwrites if this is still '--'
    document.getElementById('aq-dew').textContent = dew;

  } catch (err) {
    console.error('[weather] Fetch failed:', err);
  }
}