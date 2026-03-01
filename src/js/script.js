/* ================================================================
   ADVANCED WEATHER DASHBOARD — src/script.js

   Credentials are injected from .env at deploy time via PHP.
   At runtime the page reads them from window.ENV (set by
   php/env.php which is included in index.html on the CS server).
   ================================================================ */

'use strict';

// ── CONFIG ────────────────────────────────────────────────────
const OWM_KEY   = window.ENV?.OWM_KEY   || '';
const AQICN_KEY = window.ENV?.AQICN_KEY || '';
const USERNAME  = window.ENV?.USERNAME  || 'student_test';
const PHP_FILE  = 'php/weather.php';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun',
                'Jul','Aug','Sep','Oct','Nov','Dec'];

// ── STATE ─────────────────────────────────────────────────────
let weatherMap   = null;   // OpenLayers map instance
let markerLayer  = null;   // OL vector layer for the pin
let layerTemp    = null;   // OWM temperature tile layer
let layerPrecip  = null;   // OWM precipitation tile layer
let forecastData = null;   // cached 5-day forecast response

// ── DOM REFERENCES ────────────────────────────────────────────
const regionInput    = document.getElementById('region-input');
const citySelect     = document.getElementById('city-select');
const regionError    = document.getElementById('region-error');
const cityError      = document.getElementById('city-error');
const btnSearch      = document.getElementById('btn-search');
const btnClear       = document.getElementById('btn-clear');
const btnLog         = document.getElementById('btn-log');
const resultsSection = document.getElementById('results-section');
const chartsSection  = document.getElementById('charts-section');
const aqSection      = document.getElementById('aq-section');
const divider1       = document.getElementById('divider-1');
const divider2       = document.getElementById('divider-2');
const divider3       = document.getElementById('divider-3');
const loadingOverlay = document.getElementById('loading-overlay');

// ── LOADING ───────────────────────────────────────────────────
function showLoading() { loadingOverlay.classList.add('active'); }
function hideLoading() { loadingOverlay.classList.remove('active'); }

// ── VALIDATION ────────────────────────────────────────────────
/**
 * Validates region and city fields.
 * Shows inline error messages; returns true if valid.
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

// ── CLEAR ─────────────────────────────────────────────────────
function clearAll() {
  regionInput.value = '';
  citySelect.value  = '';
  regionInput.classList.remove('is-invalid');
  citySelect.classList.remove('is-invalid');
  regionError.classList.remove('visible');
  cityError.classList.remove('visible');

  // Hide all result sections
  [resultsSection, chartsSection, aqSection,
   divider1, divider2, divider3].forEach(el => el.classList.add('hidden'));

  // Destroy map and layers
  if (weatherMap) {
    if (layerTemp)   weatherMap.removeLayer(layerTemp);
    if (layerPrecip) weatherMap.removeLayer(layerPrecip);
    weatherMap.setTarget(null);
    weatherMap  = null;
    markerLayer = null;
    layerTemp   = null;
    layerPrecip = null;
  }

  forecastData = null;
}

// ── EVENT LISTENERS ───────────────────────────────────────────
btnSearch.addEventListener('click', handleSearch);
btnClear.addEventListener('click', clearAll);

// ── SEARCH HANDLER ────────────────────────────────────────────
async function handleSearch(e) {
  if (e) e.preventDefault();

  if (!validate()) return;

  const region = regionInput.value.trim();
  const city   = citySelect.value;

  // Prevent double-clicks
  btnSearch.disabled = true;
  showLoading();

  try {
    // (a) Save interaction to DB — fire and forget
    saveToDatabase(region, city);

    // (b) Geocode — Nominatim primary, OWM fallback
    const coords = await getCoordinates(city, region);

    if (!coords) {
      alert('No result for that location. Please try a different region or city.');
      return;
    }

    const { lat, lon } = coords;

    // Show all sections before rendering so map/charts have valid dimensions
    showAllSections(region, city);

    // Run weather fetches in parallel
    const [fcData] = await Promise.all([
      fetchForecastWeather(lat, lon),
      fetchWeather(lat, lon),
      fetchAirQuality(lat, lon),
    ]);

    // Map needs the section visible first
    updateMapCenter(lat, lon);

    // Charts use the already-returned forecast data
    displayCharts(fcData, region, city);

  } catch (err) {
    console.error('Search error:', err);
    alert('An error occurred while fetching data. Please try again.');
  } finally {
    hideLoading();
    btnSearch.disabled = false;
  }
}

// ── SHOW ALL SECTIONS ─────────────────────────────────────────
function showAllSections(region, city) {
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

// ── DATABASE SAVE ─────────────────────────────────────────────
/**
 * Sends a POST request to weather.php to log the search.
 * Fails silently — DB is skipped locally when DB_HOST is blank.
 */
async function saveToDatabase(region, city) {
  try {
    const response = await fetch(PHP_FILE, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        username: USERNAME,
        region,
        city,
        country: 'Cyprus',
      }),
    });

    if (response.status === 201) {
      console.log('DB log successful (or gracefully skipped locally).');
    } else {
      console.warn('Backend warning:', await response.text());
    }
  } catch (err) {
    console.error('Failed to connect to weather.php for logging:', err);
  }
}

// ── LOG BUTTON ────────────────────────────────────────────────
/**
 * Fetches the last 5 searches from the DB and opens the log modal.
 * Shows a loading state in the table while fetching.
 */
btnLog.addEventListener('click', async () => {
  const tbody    = document.getElementById('log-tbody');
  const logModal = bootstrap.Modal.getOrCreateInstance(document.getElementById('logModal'));

  // Show loading state immediately
  tbody.innerHTML =
    '<tr><td colspan="4" class="text-center" style="color:var(--text-muted)">Loading…</td></tr>';
  logModal.show();

  try {
    const response = await fetch(`${PHP_FILE}?username=${encodeURIComponent(USERNAME)}`);
    const data     = await response.json();

    tbody.innerHTML = '';

    if (!data || data.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="4" class="text-center" style="color:var(--text-muted)">No logs found. (DB may be skipped locally)</td></tr>';
      return;
    }

    data.forEach(log => {
      const date       = new Date(log.timestamp * 1000);
      const timeString = date.toLocaleString([], {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${timeString}</td>
        <td>${log.region  ?? '—'}</td>
        <td>${log.city    ?? '—'}</td>
        <td>${log.country ?? '—'}</td>
      `;
      tbody.appendChild(tr);
    });

  } catch (err) {
    console.error('Error fetching logs:', err);
    tbody.innerHTML =
      '<tr><td colspan="4" class="text-center text-danger">Failed to load logs.</td></tr>';
  }
});

// ── GEOCODING ─────────────────────────────────────────────────
/**
 * Geocode a location using Nominatim first, OWM as fallback.
 * @returns {Promise<{lat, lon}|null>}
 */
async function getCoordinates(city, region) {
  // 1. Nominatim (primary)
  const nominatimUrl =
    `https://nominatim.openstreetmap.org/search` +
    `?q=${encodeURIComponent(city)},${encodeURIComponent(region)},Cyprus` +
    `&format=json&limit=1`;

  try {
    const res  = await fetch(nominatimUrl);
    const data = await res.json();
    if (data && data.length > 0) {
      console.log('Coordinates found via Nominatim.');
      return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    }
  } catch (err) {
    console.warn('Nominatim failed, switching to OWM fallback:', err);
  }

  // 2. OpenWeatherMap geocoding (fallback)
  const owmUrl =
    `https://api.openweathermap.org/geo/1.0/direct` +
    `?q=${encodeURIComponent(city)},CY&limit=1&appid=${OWM_KEY}`;

  try {
    const res  = await fetch(owmUrl);
    const data = await res.json();
    if (data && data.length > 0) {
      console.log('Coordinates found via OWM fallback.');
      return { lat: data[0].lat, lon: data[0].lon };
    }
  } catch (err) {
    console.error('OWM fallback also failed:', err);
  }

  return null;
}

// ── CURRENT WEATHER ───────────────────────────────────────────
/**
 * Fetches current weather and updates the Right Now tab.
 */
async function fetchWeather(lat, lon) {
  const url =
    `https://api.openweathermap.org/data/2.5/weather` +
    `?lat=${lat}&lon=${lon}&appid=${OWM_KEY}&units=metric`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Weather API error: ${res.status}`);
    const data = await res.json();

    const temp    = Math.round(data.main.temp);
    const tempMin = Math.round(data.main.temp_min);
    const tempMax = Math.round(data.main.temp_max);

    // Dew point (Magnus approximation)
    const t     = data.main.temp;
    const rh    = data.main.humidity;
    const alpha = ((17.27 * t) / (237.7 + t)) + Math.log(rh / 100.0);
    const dew   = Math.round((237.7 * alpha) / (17.27 - alpha));

    const formatTime = (unix) =>
      new Date(unix * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Temperature block
    document.getElementById('weather-temp-val').textContent    = temp;
    document.getElementById('w-temp-min').textContent          = `L:${tempMin}°C`;
    document.getElementById('w-temp-max').textContent          = `H:${tempMax}°C`;
    document.getElementById('weather-description').textContent = data.weather[0].description;

    // Icon (4× resolution)
    document.getElementById('weather-icon').src =
      `https://openweathermap.org/img/wn/${data.weather[0].icon}@4x.png`;

    // Detail table
    document.getElementById('w-pressure').textContent = `${data.main.pressure} hPa`;
    document.getElementById('w-humidity').textContent = `${data.main.humidity}%`;
    document.getElementById('w-wind').textContent     = `${data.wind.speed} m/s`;
    document.getElementById('w-clouds').textContent   = `${data.clouds.all}%`;
    document.getElementById('w-sunrise').textContent  = formatTime(data.sys.sunrise);
    document.getElementById('w-sunset').textContent   = formatTime(data.sys.sunset);

    // Dew point — set here from weather data (more accurate than AQICN)
    document.getElementById('aq-dew').textContent = dew;

  } catch (err) {
    console.error('Error fetching current weather:', err);
  }
}

// ── FORECAST ─────────────────────────────────────────────────
/**
 * Fetches 5-day / 3-hour forecast, populates the Next 24h table,
 * and returns the full data for chart rendering.
 */
async function fetchForecastWeather(lat, lon) {
  const url =
    `https://api.openweathermap.org/data/2.5/forecast` +
    `?lat=${lat}&lon=${lon}&units=metric&appid=${OWM_KEY}`;

  const res  = await fetch(url);
  const data = await res.json();
  forecastData = data;
  populateForecastTable(data);
  return data;
}

function populateForecastTable(data) {
  const tbody = document.getElementById('forecast-tbody');
  tbody.innerHTML = '';

  // First 8 entries = next 24 hours (8 × 3 h)
  const entries = (data.list ?? []).slice(0, 8);

  entries.forEach((item, idx) => {
    const icon   = item.weather?.[0]?.icon ?? '';
    const temp   = item.main?.temp  != null ? item.main.temp.toFixed(2) : 'N.A.';
    const clouds = item.clouds?.all != null ? `${item.clouds.all}%`     : 'N.A.';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${formatLocalDateTime(item.dt)}</td>
      <td>
        <img
          src="https://openweathermap.org/img/wn/${icon}.png"
          alt="${item.weather?.[0]?.description ?? ''}"
          width="40"
        />
      </td>
      <td>${temp} °C</td>
      <td>${clouds}</td>
      <td>
        <button class="btn-view" onclick="openForecastModal(${idx})">View</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ── FORECAST MODAL ────────────────────────────────────────────
function openForecastModal(idx) {
  if (!forecastData) return;

  const item     = forecastData.list[idx];
  const cityName = forecastData.city?.name ?? 'Unknown';
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

  new bootstrap.Modal(document.getElementById('forecastModal')).show();
}

// Expose for inline onclick in populateForecastTable
window.openForecastModal = openForecastModal;

// ── MAP (OpenLayers) ──────────────────────────────────────────
/**
 * Creates the map on first call, smoothly pans on subsequent calls.
 * Adds a styled pin marker and two OWM weather tile layers.
 */
function updateMapCenter(lat, lon) {
  const coords = ol.proj.fromLonLat([lon, lat]);

  if (!weatherMap) {
    // ── First search: build the map ──
    const markerSource = new ol.source.Vector();
    markerLayer = new ol.layer.Vector({ source: markerSource });

    layerTemp = new ol.layer.Tile({
      source: new ol.source.XYZ({
        url: `https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=${OWM_KEY}`,
      }),
      opacity: 0.5,
    });

    layerPrecip = new ol.layer.Tile({
      source: new ol.source.XYZ({
        url: `https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${OWM_KEY}`,
      }),
      opacity: 0.5,
    });

    weatherMap = new ol.Map({
      target: 'map',
      layers: [
        new ol.layer.Tile({ source: new ol.source.OSM() }),
        layerTemp,
        layerPrecip,
        markerLayer,
      ],
      view: new ol.View({ center: coords, zoom: 5 }),
    });

    setTimeout(() => weatherMap.updateSize(), 100);

  } else {
    // ── Subsequent searches: animate pan ──
    weatherMap.getView().animate({ center: coords, zoom: 5, duration: 800 });
  }

  // Drop a styled red pin at the searched location
  const marker = new ol.Feature({ geometry: new ol.geom.Point(coords) });
  marker.setStyle(new ol.style.Style({
    image: new ol.style.Circle({
      radius: 9,
      fill:   new ol.style.Fill({ color: '#ff4d6d' }),
      stroke: new ol.style.Stroke({ color: '#ffffff', width: 2 }),
    }),
  }));

  markerLayer.getSource().clear();
  markerLayer.getSource().addFeature(marker);
}

// ── AIR QUALITY (AQICN) ───────────────────────────────────────
/**
 * Fetches AQI using lat/lon geolocalized feed.
 * Dew point is intentionally left to fetchWeather (more accurate).
 */
async function fetchAirQuality(lat, lon) {
  const url = `https://api.waqi.info/feed/geo:${lat};${lon}/?token=${AQICN_KEY}`;

  try {
    const res  = await fetch(url);
    const json = await res.json();

    if (json.status !== 'ok') return;

    const iaqi = json.data.iaqi;
    document.getElementById('aq-aqi').textContent  = json.data.aqi ?? '--';
    document.getElementById('aq-pm25').textContent = iaqi.pm25?.v  ?? '--';
    document.getElementById('aq-pm10').textContent = iaqi.pm10?.v  ?? '--';
    document.getElementById('aq-co').textContent   = iaqi.co?.v    ?? '--';
    document.getElementById('aq-no2').textContent  = iaqi.no2?.v   ?? '--';
    document.getElementById('aq-o3').textContent   = iaqi.o3?.v    ?? '--';
    document.getElementById('aq-so2').textContent  = iaqi.so2?.v   ?? '--';
    // Dew is set by fetchWeather; only fall back to AQICN if still unset
    const dewEl = document.getElementById('aq-dew');
    if (!dewEl.textContent || dewEl.textContent === '--') {
      dewEl.textContent = iaqi.dew?.v ?? '--';
    }

  } catch (err) {
    console.error('Error fetching air quality:', err);
  }
}

// ── CHARTS (Plotly) ───────────────────────────────────────────
function displayCharts(data, region, city) {
  const list      = data.list ?? [];
  const times     = list.map(i => i.dt_txt);
  const temps     = list.map(i => i.main?.temp     ?? null);
  const humids    = list.map(i => i.main?.humidity ?? null);
  const pressures = list.map(i => i.main?.pressure ?? null);

  const maxTemp  = Math.max(...temps.filter(Boolean));
  const maxHumid = Math.max(...humids.filter(Boolean));
  const maxPress = Math.max(...pressures.filter(Boolean));

  const paperBg     = 'rgba(0,0,0,0)';
  const plotBg      = 'rgba(255,255,255,0.02)';
  const fontClr     = '#a8cfe0';
  const gridClr     = 'rgba(255,255,255,0.06)';
  const gaugeMargin = { l: 30, r: 30, t: 50, b: 10 };

  // ── Gauges ──
  function gaugeTrace(value, title, color, rangeMax) {
    return {
      domain:  { x: [0, 1], y: [0, 1] },
      value,
      title:   { text: title, font: { size: 13, color: fontClr } },
      type:    'indicator',
      mode:    'gauge+number',
      number:  { font: { color: '#ffffff' } },
      gauge: {
        axis:    { range: [null, rangeMax], tickwidth: 1, tickcolor: fontClr },
        bar:     { color },
        bgcolor: 'rgba(255,255,255,0.04)',
      },
    };
  }

  const gaugeLayout = {
    margin:        gaugeMargin,
    height:        230,
    paper_bgcolor: paperBg,
    font:          { color: fontClr },
  };

  Plotly.newPlot('gauge-temp',
    [gaugeTrace(maxTemp,  'Max Temperature (C)', 'darkblue',  50)],
    gaugeLayout, { responsive: true });

  Plotly.newPlot('gauge-humidity',
    [gaugeTrace(maxHumid, 'Max Humidity (%)',    'darkred',   100)],
    gaugeLayout, { responsive: true });

  Plotly.newPlot('gauge-pressure',
    [gaugeTrace(maxPress, 'Max Pressure (hPa)',  'darkgreen', 1100)],
    gaugeLayout, { responsive: true });

  // ── Line charts ──
  function lineLayout(title) {
    return {
      title:         { text: title, font: { size: 13, color: '#ffffff' } },
      margin:        { l: 50, r: 15, t: 40, b: 55 },
      height:        230,
      paper_bgcolor: paperBg,
      plot_bgcolor:  plotBg,
      font:          { color: fontClr },
      xaxis:         { color: fontClr, gridcolor: gridClr, tickfont: { size: 10 } },
      yaxis:         { color: fontClr, gridcolor: gridClr },
    };
  }

  const lineStyle = {
    mode:   'lines+markers',
    line:   { color: '#60a5fa' },
    marker: { color: '#60a5fa', size: 4 },
  };

  Plotly.newPlot('chart-temp',
    [{ x: times, y: temps,     ...lineStyle }],
    lineLayout('Temperature (C)'), { responsive: true });

  Plotly.newPlot('chart-humidity',
    [{ x: times, y: humids,    ...lineStyle }],
    lineLayout('Humidity (%)'), { responsive: true });

  Plotly.newPlot('chart-pressure',
    [{ x: times, y: pressures, ...lineStyle }],
    lineLayout('Pressure (hPa)'), { responsive: true });
}

// ── DATE / TIME HELPERS ───────────────────────────────────────
/**
 * Unix timestamp (seconds) → "YYYY-MM-DD HH:MM" in local time
 */
function formatLocalDateTime(unixSec) {
  const d  = new Date(unixSec * 1000);
  const Y  = d.getFullYear();
  const Mo = String(d.getMonth() + 1).padStart(2, '0');
  const D  = String(d.getDate()).padStart(2, '0');
  const H  = String(d.getHours()).padStart(2, '0');
  const Mi = String(d.getMinutes()).padStart(2, '0');
  return `${Y}-${Mo}-${D} ${H}:${Mi}`;
}

/**
 * Unix timestamp → "D Mon YYYY HH:MM" for the forecast modal title
 */
function formatModalDateTime(unixSec) {
  const d  = new Date(unixSec * 1000);
  const D  = d.getDate();
  const Mo = MONTHS[d.getMonth()];
  const Y  = d.getFullYear();
  const H  = String(d.getHours()).padStart(2, '0');
  const Mi = String(d.getMinutes()).padStart(2, '0');
  return `${D} ${Mo} ${Y} ${H}:${Mi}`;
}