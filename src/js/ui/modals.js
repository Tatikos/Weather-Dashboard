/* ================================================================
   js/ui/modals.js
   Handles fetching logs, wiring up the "Search Again" buttons,
   and displaying the forecast details modal.
   ================================================================ */

import { fetchLogs } from '../api/database.js';
import state from '../state.js';

export function initLogModal() {
  const btnLog = document.getElementById('btn-log');
  const tbody = document.getElementById('log-tbody');
  const logModalEl = document.getElementById('logModal');

  if (!btnLog || !tbody || !logModalEl) {
    console.warn("Log modal HTML elements missing.");
    return;
  }

  // ── 1. Listen for clicks on the "Search Again" buttons ──
  tbody.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-re-search');
    if (!btn) return;

    // Grab the stored data from the button
    const { region, city, country } = btn.dataset;

    // Close the modal
    bootstrap.Modal.getInstance(logModalEl).hide();

    // Set the Country dropdown and trigger the "change" event so cities load
    const countrySelect = document.getElementById('country-select');
    if (countrySelect) {
      countrySelect.value = country || 'Cyprus';
      countrySelect.dispatchEvent(new Event('change'));
    }

    // Wait a brief moment for the CountriesNow API to populate the city list
    setTimeout(() => {
      const regionInput = document.getElementById('region-input');
      if (regionInput) regionInput.value = region;
      
      const citySelect = document.getElementById('city-select');
      if (citySelect) {
        // If the city spelling differs slightly, dynamically add it to the dropdown
        const optionExists = Array.from(citySelect.options).some(opt => opt.value === city);
        if (!optionExists && city) {
          const opt = document.createElement('option');
          opt.value = city;
          opt.textContent = city;
          citySelect.appendChild(opt);
        }
        
        citySelect.value = city;
        citySelect.disabled = false;
      }

      // Automatically click the main Search button
      const searchBtn = document.getElementById('btn-search');
      if (searchBtn) searchBtn.click();
    }, 150); // 150ms delay gives the UI time to fetch and render the city list
  });

  // ── 2. Open Modal & Fetch Logs ──
  btnLog.addEventListener('click', async () => {
    const logModal = bootstrap.Modal.getOrCreateInstance(logModalEl);

    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Loading…</td></tr>';
    logModal.show();

    try {
      const rows = await fetchLogs();
      tbody.innerHTML = '';

      if (!rows || rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No logs found.</td></tr>';
        return;
      }

      rows.forEach(row => {
        const date = new Date(row.timestamp * 1000);
        const timeString = date.toLocaleString([], {
          year: 'numeric', month: 'short', day: 'numeric',
          hour: '2-digit', minute: '2-digit',
        });

        const safeRegion = row.region ?? '';
        const safeCity = row.city ?? '';
        const safeCountry = row.country ?? 'Cyprus';

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${timeString}</td>
          <td>${safeRegion || '—'}</td>
          <td>${safeCity || '—'}</td>
          <td>${safeCountry}</td>
          <td>
            <button class="btn btn-sm btn-outline-info btn-re-search" 
                    data-region="${safeRegion}" 
                    data-city="${safeCity}" 
                    data-country="${safeCountry}"
                    title="Search Again">
              <i class="fa-solid fa-rotate-right"></i>
            </button>
          </td>
        `;
        tbody.appendChild(tr);
      });

    } catch (err) {
      console.error('[modals] Log fetch failed:', err);
      tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Failed to load logs.</td></tr>';
    }
  });
}

/**
 * Opens the forecast details modal for a specific 3-hour block.
 * @param {number} index - The index of the forecast item in the state array
 */
export function openForecastModal(index) {
  const forecastModalEl = document.getElementById('forecastModal'); 
  if (!forecastModalEl || !state.forecastData) return;

  const item = state.forecastData.list[index];
  if (!item) return;

  const tempObj = item.main || {};
  const weatherObj = item.weather?.[0] || {};
  const windObj = item.wind || {};
  const modalTitle = document.getElementById('forecastModalTitle');
  const dIcon = document.getElementById('modal-icon');
  const dDesc = document.getElementById('modal-weather-text');
  const dHum = document.getElementById('modal-humidity');
  const dPressure = document.getElementById('modal-pressure');
  const dWind = document.getElementById('modal-wind');
  if (modalTitle) {
    const dateStr = new Date(item.dt * 1000).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
    modalTitle.textContent = `Forecast: ${dateStr}`;
  }
  
  if (dIcon) {
    dIcon.src = `https://openweathermap.org/img/wn/${weatherObj.icon}@2x.png`;
  }
  
  if (dDesc) {
    dDesc.innerHTML = `<strong>${tempObj.temp} °C</strong> (Feels like ${tempObj.feels_like} °C)<br>
                       <span style="text-transform: capitalize;">${weatherObj.description}</span>`;
  }
  
  if (dHum) dHum.textContent = `${tempObj.humidity}%`;
  if (dPressure) dPressure.textContent = `${tempObj.pressure} hPa`;
  if (dWind) dWind.textContent = `${windObj.speed} m/s`;
  const modal = bootstrap.Modal.getOrCreateInstance(forecastModalEl);
  modal.show();
}