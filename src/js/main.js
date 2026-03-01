/* ================================================================
   js/main.js  —  Application entry point
   
   Responsibilities:
     - Form validation
     - Search orchestration (geocode → fetch → render)
     - Button event wiring (search, clear)
     - Initialise log modal listener
   ================================================================ */

'use strict';

// ── API ──────────────────────────────────────────────────────────
import { getCoordinates }      from './api/geocoding.js';
import { fetchWeather }        from './api/weather.js';
import { fetchForecastWeather } from './api/forecast.js';
import { fetchAirQuality }     from './api/airquality.js';
import { saveToDatabase }      from './api/database.js';

// ── UI ───────────────────────────────────────────────────────────
import { showLoading, hideLoading } from './ui/loading.js';
import { showAllSections, clearAll } from './ui/sections.js';
import { updateMapCenter }          from './ui/map.js';
import { displayCharts }            from './ui/charts.js';
import { initLogModal }             from './ui/modals.js';

// ── DOM ──────────────────────────────────────────────────────────
const regionInput = document.getElementById('region-input');
const citySelect  = document.getElementById('city-select');
const regionError = document.getElementById('region-error');
const cityError   = document.getElementById('city-error');
const btnSearch   = document.getElementById('btn-search');
const btnClear    = document.getElementById('btn-clear');

// ── Init ─────────────────────────────────────────────────────────
btnSearch.addEventListener('click', handleSearch);
btnClear.addEventListener('click', clearAll);
initLogModal();

// ── Validation ───────────────────────────────────────────────────
/**
 * Validates the region and city inputs.
 * Shows inline error messages below each field.
 * @returns {boolean} true if both fields are valid
 */
function validate() {
  let valid = true;

  if (!regionInput.value.trim()) {
    regionInput.classList.add('is-invalid');
    regionError.classList.add('visible');
    valid = false;
  } else {
    regionInput.classList.remove('is-invalid');
    regionError.classList.remove('visible');
  }

  if (!citySelect.value) {
    citySelect.classList.add('is-invalid');
    cityError.classList.add('visible');
    valid = false;
  } else {
    citySelect.classList.remove('is-invalid');
    cityError.classList.remove('visible');
  }

  return valid;
}

// ── Search handler ────────────────────────────────────────────────
/**
 * Main search flow:
 *  1. Validate form
 *  2. Fire-and-forget DB save
 *  3. Geocode (Nominatim → OWM fallback)
 *  4. Show all result sections
 *  5. Fetch weather, forecast, air quality in parallel
 *  6. Render map + charts
 */
async function handleSearch(e) {
  if (e) e.preventDefault();
  if (!validate()) return;

  const region = regionInput.value.trim();
  const city   = citySelect.value;

  btnSearch.disabled = true;
  showLoading();

  try {
    // Fire-and-forget — failure is non-critical
    saveToDatabase(region, city);

    const coords = await getCoordinates(city, region);
    if (!coords) {
      alert('No result for that location. Please try a different region or city.');
      return;
    }

    const { lat, lon } = coords;

    // Sections must be visible before map + Plotly render
    showAllSections(region, city);

    // Parallel fetch — forecast must resolve before displayCharts
    const [fcData] = await Promise.all([
      fetchForecastWeather(lat, lon),
      fetchWeather(lat, lon),
      fetchAirQuality(lat, lon),
    ]);

    updateMapCenter(lat, lon);
    displayCharts(fcData, region, city);

  } catch (err) {
    console.error('[main] Search error:', err);
    alert('An error occurred while fetching data. Please try again.');
  } finally {
    hideLoading();
    btnSearch.disabled = false;
  }
}