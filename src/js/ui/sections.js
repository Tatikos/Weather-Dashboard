/* ================================================================
   js/ui/sections.js
   Shows / hides the results, charts, and AQ sections.
   Also owns the clearAll() function which resets the whole page.
   ================================================================ */

import state from '../state.js';

const resultsSection = document.getElementById('results-section');
const chartsSection  = document.getElementById('charts-section');
const aqSection      = document.getElementById('aq-section');
const divider1       = document.getElementById('divider-1');
const divider2       = document.getElementById('divider-2');
const divider3       = document.getElementById('divider-3');

/**
 * Reveal all three result sections and update their dynamic titles.
 *
 * @param {string} region
 * @param {string} city
 */
export function showAllSections(region, city) {
  divider1.classList.remove('hidden');
  resultsSection.classList.remove('hidden');
  divider2.classList.remove('hidden');
  chartsSection.classList.remove('hidden');
  divider3.classList.remove('hidden');
  aqSection.classList.remove('hidden');

  document.getElementById('gauges-title').textContent =
    `Weather extremes for ${region}, ${city} within next 5 days`;
  document.getElementById('charts-title').textContent =
    `Weather Forecast for ${region}, ${city}`;
  document.getElementById('aq-title').textContent =
    `Air Quality for ${region}, ${city}`;
}

/**
 * Reset the entire page to its initial state:
 * - Clear form inputs and validation styles
 * - Hide all result sections
 * - Destroy the OpenLayers map and its layers
 * - Clear cached forecast data
 */
export function clearAll() {
  // ── Form ──
  const regionInput = document.getElementById('region-input');
  const citySelect  = document.getElementById('city-select');
  regionInput.value = '';
  citySelect.value  = '';
  regionInput.classList.remove('is-invalid');
  citySelect.classList.remove('is-invalid');
  document.getElementById('region-error').classList.remove('visible');
  document.getElementById('city-error').classList.remove('visible');

  // ── Sections ──
  [resultsSection, chartsSection, aqSection,
   divider1, divider2, divider3].forEach(el => el.classList.add('hidden'));

  // ── Map ──
  if (state.weatherMap) {
    if (state.layerTemp)   state.weatherMap.removeLayer(state.layerTemp);
    if (state.layerPrecip) state.weatherMap.removeLayer(state.layerPrecip);
    state.weatherMap.setTarget(null);
    state.weatherMap  = null;
    state.markerLayer = null;
    state.layerTemp   = null;
    state.layerPrecip = null;
  }

  // ── State ──
  state.forecastData = null;
}