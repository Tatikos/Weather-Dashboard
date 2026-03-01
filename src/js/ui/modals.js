/* ================================================================
   js/ui/modals.js
   Forecast detail modal and log modal logic.
   ================================================================ */

import state from '../state.js';
import { formatModalDateTime } from '../helpers.js';
import { fetchLogs } from '../api/database.js';

// ── Forecast detail modal ────────────────────────────────────────

/**
 * Populate and open the forecast detail modal for a given row index.
 * @param {number} idx - Row index in state.forecastData.list
 */
export function openForecastModal(idx) {
  if (!state.forecastData) return;

  const item     = state.forecastData.list[idx];
  const cityName = state.forecastData.city?.name ?? 'Unknown';
  const na       = 'N.A.';

  document.getElementById('forecastModalTitle').textContent =
    `Weather in ${cityName} on ${formatModalDateTime(item.dt)}`;

  document.getElementById('modal-icon').src =
    `https://openweathermap.org/img/wn/${item.weather?.[0]?.icon ?? '01d'}@2x.png`;

  const main = item.weather?.[0]?.main        ?? na;
  const desc = item.weather?.[0]?.description ?? na;
  document.getElementById('modal-weather-text').textContent = `${main} (${desc})`;

  document.getElementById('modal-humidity').textContent =
    item.main?.humidity != null ? `${item.main.humidity}%`    : na;
  document.getElementById('modal-pressure').textContent =
    item.main?.pressure != null ? `${item.main.pressure} hPa` : na;
  document.getElementById('modal-wind').textContent =
    item.wind?.speed    != null ? `${item.wind.speed} m/s`    : na;

  bootstrap.Modal.getOrCreateInstance(
    document.getElementById('forecastModal')
  ).show();
}

// ── Log modal ────────────────────────────────────────────────────

/**
 * Wire up the Log button.
 * Opens the modal immediately with a loading state, then fetches
 * and renders the last 5 DB entries.
 */
export function initLogModal() {
  document.getElementById('btn-log').addEventListener('click', async () => {
    const tbody    = document.getElementById('log-tbody');
    const logModal = bootstrap.Modal.getOrCreateInstance(
      document.getElementById('logModal')
    );

    // Show loading state immediately so the user gets feedback
    tbody.innerHTML =
      '<tr><td colspan="4" class="text-center" style="color:var(--text-muted)">Loading…</td></tr>';
    logModal.show();

    try {
      const rows = await fetchLogs();
      tbody.innerHTML = '';

      if (!rows || rows.length === 0) {
        tbody.innerHTML =
          '<tr><td colspan="4" class="text-center" style="color:var(--text-muted)">' +
          'No logs found. (DB is skipped locally)</td></tr>';
        return;
      }

      rows.forEach(row => {
        const date       = new Date(row.timestamp * 1000);
        const timeString = date.toLocaleString([], {
          year: 'numeric', month: 'short', day: 'numeric',
          hour: '2-digit', minute: '2-digit',
        });

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${timeString}</td>
          <td>${row.region  ?? '—'}</td>
          <td>${row.city    ?? '—'}</td>
          <td>${row.country ?? '—'}</td>
        `;
        tbody.appendChild(tr);
      });

    } catch (err) {
      console.error('[modals] Log fetch failed:', err);
      tbody.innerHTML =
        '<tr><td colspan="4" class="text-center text-danger">Failed to load logs.</td></tr>';
    }
  });
  window.openForecastModal = openForecastModal;
}