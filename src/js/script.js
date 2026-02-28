/* ================================================================
   ADVANCED WEATHER DASHBOARD — src/script.js
   
   Credentials are injected from .env at deploy time via PHP.
   At runtime the page reads them from window.ENV (set by
   php/env.php which is included in index.html on the CS server).
   
   For local testing without PHP, fall back to the constants below.
   ================================================================ */

'use strict';

// ── CONFIG ────────────────────────────────────────────────────
// Locally you can set these directly for testing:
const ENV = window.ENV || {
  OWM_KEY:  'YOUR_OWM_API_KEY',
  AQICN_KEY:'YOUR_AQICN_TOKEN',
  USERNAME: 'YOUR_UCY_USERNAME',
};

const PHP_FILE = 'php/weather.php';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun',
                'Jul','Aug','Sep','Oct','Nov','Dec'];

// ── STATE ─────────────────────────────────────────────────────
let olMap        = null;
let layerTemp    = null;
let layerPrecip  = null;
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
  // Reset inputs
  regionInput.value = '';
  citySelect.value  = '';
  regionInput.classList.remove('is-invalid');
  citySelect.classList.remove('is-invalid');
  regionError.classList.remove('visible');
  cityError.classList.remove('visible');

  // Hide result sections
  [resultsSection, chartsSection, aqSection,
   divider1, divider2, divider3].forEach(el => el.classList.add('hidden'));

  // Destroy map and layers
  if (olMap) {
    if (layerTemp)   olMap.removeLayer(layerTemp);
    if (layerPrecip) olMap.removeLayer(layerPrecip);
    olMap.setTarget(null);
    olMap       = null;
    layerTemp   = null;
    layerPrecip = null;
  }

  forecastData = null;
}

// ── SEARCH HANDLER ────────────────────────────────────────────
btnSearch.addEventListener('click', handleSearch);
btnClear.addEventListener('click', clearAll);

async function handleSearch() {
  if (!validate()) return;

  const region = regionInput.value.trim();
  const city   = citySelect.value;

  showLoading();

  // (a) Save interaction to DB (fire-and-forget)
  saveToDatabase(region, city);

  // (b) Geocode via Nominatim
  const nominatimUrl =
    `https://nominatim.openstreetmap.org/search` +
    `?q=${encodeURIComponent(region)},${encodeURIComponent(city)}` +
    `&format=json&addressdetails=1`;

  try {
    const geoRes  = await fetch(nominatimUrl, { headers: { 'Accept-Language': 'en' } });
    const geoData = await geoRes.json();

    if (!geoData || geoData.length === 0) {
      hideLoading();
      alert('No result for that location.');
      return;
    }

    const lat = parseFloat(geoData[0].lat);
    const lon = parseFloat(geoData[0].lon);

    // Show results container first so map has a valid target
    showResultsUI();

    // Parallel: current weather + forecast
    const [, fcData] = await Promise.all([
      fetchCurrentWeather(lat, lon),
      fetchForecastWeather(lat, lon),
    ]);

    // Map (needs results section visible)
    createMap(lat, lon);

    // Charts & air quality
    displayCharts(fcData, region, city);
    showChartsUI(region, city);

    fetchAirQuality(city, region);
    showAQUI(region, city);

    hideLoading();

  } catch (err) {
    hideLoading();
    console.error('Search error:', err);
    alert('An error occurred while fetching weather data. Please try again.');
  }
}

// ── SHOW / HIDE UI SECTIONS ───────────────────────────────────
function showResultsUI() {
  divider1.classList.remove('hidden');
  resultsSection.classList.remove('hidden');
}
function showChartsUI(region, city) {
  divider2.classList.remove('hidden');
  chartsSection.classList.remove('hidden');
  document.getElementById('gauges-title').textContent =
    `Weather extremes for ${region}, ${city} within next 5 days`;
  document.getElementById('charts-title').textContent =
    `Weather Forecast for ${region}, ${city}`;
}
function showAQUI(region, city) {
  divider3.classList.remove('hidden');
  aqSection.classList.remove('hidden');
  document.getElementById('aq-title').textContent =
    `Air Quality for ${region}, ${city}`;
}

// ── DATABASE SAVE (PHP POST) ──────────────────────────────────
function saveToDatabase(region, city) {
  const payload = {
    username: ENV.USERNAME,
    region,
    city,
    country: 'Cyprus',
  };
  fetch(PHP_FILE, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  }).catch(err => console.warn('DB save failed:', err));
}

// ── CURRENT WEATHER ───────────────────────────────────────────
async function fetchCurrentWeather(lat, lon) {
  const url =
    `https://api.openweathermap.org/data/2.5/weather` +
    `?lat=${lat}&lon=${lon}&units=metric&APPID=${ENV.OWM_KEY}`;

  const res  = await fetch(url);
  const data = await res.json();
  displayCurrentWeather(data);
  return data;
}

function displayCurrentWeather(d) {
  const na = 'N.A.';

  // Icon
  const icon = d.weather?.[0]?.icon;
  document.getElementById('weather-icon').src =
    icon ? `https://openweathermap.org/img/wn/${icon}@2x.png` : '';

  // Description + location
  const desc = d.weather?.[0]?.description ?? na;
  const loc  = d.name ?? na;
  document.getElementById('weather-description').textContent = `${desc} in ${loc}`;

  // Temperature
  document.getElementById('weather-temp-val').textContent = d.main?.temp    ?? na;
  document.getElementById('w-temp-min').textContent       = `L:${d.main?.temp_min ?? na}°C`;
  document.getElementById('w-temp-max').textContent       = `H:${d.main?.temp_max ?? na}°C`;

  // Detail rows
  document.getElementById('w-pressure').textContent = d.main?.pressure != null ? `${d.main.pressure} hPa`       : na;
  document.getElementById('w-humidity').textContent = d.main?.humidity != null ? `${d.main.humidity} %`         : na;
  document.getElementById('w-wind').textContent     = d.wind?.speed    != null ? `${d.wind.speed} meters/sec`   : na;
  document.getElementById('w-clouds').textContent   = d.clouds?.all    != null ? `${d.clouds.all} %`            : na;

  // Sunrise / sunset — Unix UTC → local time
  document.getElementById('w-sunrise').textContent =
    d.sys?.sunrise ? formatLocalDateTime(d.sys.sunrise) : na;
  document.getElementById('w-sunset').textContent =
    d.sys?.sunset  ? formatLocalDateTime(d.sys.sunset)  : na;
}

// ── FORECAST ─────────────────────────────────────────────────
async function fetchForecastWeather(lat, lon) {
  const url =
    `https://api.openweathermap.org/data/2.5/forecast` +
    `?lat=${lat}&lon=${lon}&units=metric&APPID=${ENV.OWM_KEY}`;

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
    const dt     = new Date(item.dt * 1000);
    const icon   = item.weather?.[0]?.icon ?? '';
    const temp   = item.main?.temp  != null ? item.main.temp.toFixed(2)  : 'N.A.';
    const clouds = item.clouds?.all != null ? `${item.clouds.all} %`     : 'N.A.';

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

// Exposed globally so inline onclick can reach it
function openForecastModal(idx) {
  if (!forecastData) return;

  const item     = forecastData.list[idx];
  const cityName = forecastData.city?.name ?? 'Unknown';
  const na       = 'N.A.';

  // Modal title: "Weather in {city} on {d Mon YYYY HH:MM}"
  document.getElementById('forecastModalTitle').textContent =
    `Weather in ${cityName} on ${formatModalDateTime(item.dt)}`;

  document.getElementById('modal-icon').src =
    `https://openweathermap.org/img/wn/${item.weather?.[0]?.icon ?? '01d'}@2x.png`;

  const main = item.weather?.[0]?.main        ?? na;
  const desc = item.weather?.[0]?.description ?? na;
  document.getElementById('modal-weather-text').textContent = `${main} (${desc})`;

  document.getElementById('modal-humidity').textContent =
    item.main?.humidity != null ? `${item.main.humidity} %`       : na;
  document.getElementById('modal-pressure').textContent =
    item.main?.pressure != null ? `${item.main.pressure} hPa`     : na;
  document.getElementById('modal-wind').textContent =
    item.wind?.speed    != null ? `${item.wind.speed} meters/sec` : na;

  new bootstrap.Modal(document.getElementById('forecastModal')).show();
}

// Make it accessible from inline HTML onclick
window.openForecastModal = openForecastModal;

// ── CHARTS (Plotly) ───────────────────────────────────────────
function displayCharts(data, region, city) {
  const list      = data.list ?? [];
  const times     = list.map(i => i.dt_txt);
  const temps     = list.map(i => i.main?.temp      ?? null);
  const humids    = list.map(i => i.main?.humidity  ?? null);
  const pressures = list.map(i => i.main?.pressure  ?? null);

  const maxTemp  = Math.max(...temps.filter(v => v !== null));
  const maxHumid = Math.max(...humids.filter(v => v !== null));
  const maxPress = Math.max(...pressures.filter(v => v !== null));

  // ── Shared layout pieces ──
  const paperBg = 'rgba(0,0,0,0)';
  const plotBg  = 'rgba(255,255,255,0.02)';
  const fontClr = '#7ba8be';
  const gridClr = 'rgba(255,255,255,0.06)';
  const gaugeMargin = { l: 30, r: 30, t: 50, b: 10 };

  function gaugeTrace(value, title, color, rangeMax) {
    return {
      domain:  { x: [0, 1], y: [0, 1] },
      value,
      title:   { text: title, font: { size: 13, color: fontClr } },
      type:    'indicator',
      mode:    'gauge+number',
      number:  { font: { color: '#dff0f8' } },
      gauge: {
        axis: { range: [null, rangeMax], tickwidth: 1, tickcolor: fontClr },
        bar:  { color },
        bgcolor: 'rgba(255,255,255,0.04)',
      },
    };
  }

  const gaugeLayout = {
    margin: gaugeMargin,
    height: 230,
    paper_bgcolor: paperBg,
    font: { color: fontClr },
  };

  Plotly.newPlot('gauge-temp',
    [gaugeTrace(maxTemp,  'Max Temperature (C)',  'darkblue',  50)],
    gaugeLayout, { responsive: true });

  Plotly.newPlot('gauge-humidity',
    [gaugeTrace(maxHumid, 'Max Humidity (%)',     'darkred',   100)],
    gaugeLayout, { responsive: true });

  Plotly.newPlot('gauge-pressure',
    [gaugeTrace(maxPress, 'Max Pressure (hPa)',   'darkgreen', 1100)],
    gaugeLayout, { responsive: true });

  // ── Line charts ──
  function lineLayout(title) {
    return {
      title:   { text: title, font: { size: 13, color: '#dff0f8' } },
      margin:  { l: 50, r: 15, t: 40, b: 55 },
      height:  230,
      paper_bgcolor: paperBg,
      plot_bgcolor:  plotBg,
      font:   { color: fontClr },
      xaxis:  { color: fontClr, gridcolor: gridClr, tickfont: { size: 10 } },
      yaxis:  { color: fontClr, gridcolor: gridClr },
    };
  }

  const lineStyle = { mode: 'lines+markers', line: { color: '#60a5fa' }, marker: { color: '#60a5fa', size: 4 } };

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

// ── MAP (OpenLayers) ──────────────────────────────────────────
function createMap(lat, lon) {
  // Clean up any previous instance
  if (olMap) {
    olMap.setTarget(null);
    olMap = null;
  }

  olMap = new ol.Map({
    target: 'map',
    layers: [
      new ol.layer.Tile({ source: new ol.source.OSM() }),
    ],
    view: new ol.View({
      center: ol.proj.fromLonLat([lon, lat]),
      zoom:   5,
    }),
  });

  layerTemp = new ol.layer.Tile({
    source: new ol.source.XYZ({
      url: `https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=${ENV.OWM_KEY}`,
    }),
    opacity: 0.5,
  });

  layerPrecip = new ol.layer.Tile({
    source: new ol.source.XYZ({
      url: `https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${ENV.OWM_KEY}`,
    }),
    opacity: 0.5,
  });

  olMap.addLayer(layerTemp);
  olMap.addLayer(layerPrecip);

  // Force size recalculation after section becomes visible
  setTimeout(() => olMap.updateSize(), 100);
}

// ── AIR QUALITY (AQICN) ───────────────────────────────────────
function fetchAirQuality(city) {
  const url =
    `https://api.waqi.info/feed/${encodeURIComponent(city)}/` +
    `?token=${ENV.AQICN_KEY}`;

  fetch(url)
    .then(r => r.json())
    .then(data => {
      if (data.status !== 'ok') {
        setAllAQ('N.A.');
        return;
      }
      const d = data.data;
      setAQ('aq-aqi',  d.aqi);
      setAQ('aq-pm25', d.iaqi?.pm25?.v);
      setAQ('aq-pm10', d.iaqi?.pm10?.v);
      setAQ('aq-co',   d.iaqi?.co?.v);
      setAQ('aq-no2',  d.iaqi?.no2?.v);
      setAQ('aq-o3',   d.iaqi?.o3?.v);
      setAQ('aq-so2',  d.iaqi?.so2?.v);
      setAQ('aq-dew',  d.iaqi?.dew?.v);
    })
    .catch(() => setAllAQ('N.A.'));
}

function setAQ(id, val) {
  document.getElementById(id).textContent =
    (val !== undefined && val !== null) ? val : 'N.A.';
}
function setAllAQ(val) {
  ['aq-aqi','aq-pm25','aq-pm10','aq-co','aq-no2','aq-o3','aq-so2','aq-dew']
    .forEach(id => setAQ(id, val));
}

// ── LOG BUTTON ────────────────────────────────────────────────
btnLog.addEventListener('click', () => {
  const url = `${PHP_FILE}?username=${encodeURIComponent(ENV.USERNAME)}`;

  fetch(url)
    .then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then(rows => renderLogModal(rows))
    .catch(err => {
      console.error('Log fetch error:', err);
      renderLogModal([]);
    });
});

function renderLogModal(rows) {
  const tbody = document.getElementById('log-tbody');
  tbody.innerHTML = '';

  if (!rows || rows.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="4" class="text-center" style="color:var(--text-muted)">No records found.</td></tr>';
  } else {
    rows.forEach(row => {
      const ts  = formatLocalDateTime(row.timestamp);
      const tr  = document.createElement('tr');
      tr.innerHTML = `
        <td>${ts}</td>
        <td>${row.region  ?? '—'}</td>
        <td>${row.city    ?? '—'}</td>
        <td>${row.country ?? '—'}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  new bootstrap.Modal(document.getElementById('logModal')).show();
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
 * Unix timestamp → "D Mon YYYY HH:MM" for modal title
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