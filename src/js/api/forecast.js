/* ================================================================
   js/api/forecast.js
   Fetches the 5-day / 3-hour forecast securely via PHP proxy.
   ================================================================ */

import state from '../state.js';
import { formatLocalDateTime } from '../helpers.js';

export async function fetchForecastWeather(lat, lon) {
  const url = `php/proxy.php?service=forecast&lat=${lat}&lon=${lon}`;

  const res  = await fetch(url);
  const data = await res.json();

  state.forecastData = data;
  populateForecastTable(data);

  return data;
}

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
        <img src="https://openweathermap.org/img/wn/${icon}.png" alt="${desc}" width="44" />
      </td>
      <td>${temp} °C</td>
      <td>${clouds}</td>
      <td>
        <button class="btn btn-sm btn-outline-info btn-view" data-idx="${idx}">View</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.onclick = (e) => {
    const btn = e.target.closest('.btn-view');
    if (!btn) return;
    
    import('../ui/modals.js').then(({ openForecastModal }) => {
      if (openForecastModal) {
        openForecastModal(parseInt(btn.dataset.idx, 10));
      }
    });
  };
}