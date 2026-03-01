/* ================================================================
   js/api/forecast.js
   Fetches the 5-day / 3-hour forecast from OpenWeatherMap,
   populates the Next 24h table, and returns the full response
   for chart rendering.
   ================================================================ */

import { OWM_KEY } from '../config.js';
import state from '../state.js';
import { formatLocalDateTime } from '../helpers.js';

/**
 * Fetch 5-day forecast, store in state, populate table.
 *
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<Object>} Full OWM forecast API response
 */
export async function fetchForecastWeather(lat, lon) {
  const url =
    `https://api.openweathermap.org/data/2.5/forecast` +
    `?lat=${lat}&lon=${lon}&units=metric&appid=${OWM_KEY}`;

  const res  = await fetch(url);
  const data = await res.json();

  state.forecastData = data;
  populateForecastTable(data);

  return data;
}

/**
 * Renders the first 8 forecast entries (next 24 h) into the table.
 * Each row gets a View button that triggers openForecastModal(idx).
 *
 * @param {Object} data - OWM forecast API response
 */
export function populateForecastTable(data) {
  const tbody  = document.getElementById('forecast-tbody');
  tbody.innerHTML = '';

  const entries = (data.list ?? []).slice(0, 8);

  entries.forEach((item, idx) => {
    const icon   = item.weather?.[0]?.icon ?? '';
    const desc   = item.weather?.[0]?.description ?? '';
    const temp   = item.main?.temp  != null ? item.main.temp.toFixed(2) : 'N.A.';
    const clouds = item.clouds?.all != null ? `${item.clouds.all}%`     : 'N.A.';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${formatLocalDateTime(item.dt)}</td>
      <td>
        <img
          src="https://openweathermap.org/img/wn/${icon}.png"
          alt="${desc}"
          width="44"
        />
      </td>
      <td>${temp} °C</td>
      <td>${clouds}</td>
      <td>
        <button class="btn-view" data-idx="${idx}">View</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Delegate click to the tbody instead of inline onclick
  // (keeps HTML clean and avoids polluting window scope)
  tbody.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-view');
    if (!btn) return;
    // Dynamically import to avoid circular deps with modals.js
    import('../ui/modals.js').then(({ openForecastModal }) => {
      openForecastModal(parseInt(btn.dataset.idx, 10));
    });
  });
}