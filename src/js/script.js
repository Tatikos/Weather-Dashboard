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
const OWM_KEY = window.ENV.OWM_KEY;
const AQICN_KEY = window.ENV.AQICN_KEY;
const USERNAME = window.ENV.USERNAME || "student_test";
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

/**
 * Sends a POST request to weather.php to log the search
 */
async function saveToDatabase(region, city) {
  try {
    const payload = {
      username: USERNAME,
      region: region,
      city: city,
      country: "Cyprus" // Your PHP expects this!
    };

    const response = await fetch('php/weather.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (response.status === 201) {
      console.log("Database log successful (or gracefully skipped locally).");
    } else {
      console.warn("Backend warning:", await response.text());
    }
  } catch (error) {
    console.error("Failed to connect to weather.php for logging:", error);
  }
}

/**
 * Fetches the last 5 searches from the database and opens the modal
 */
document.getElementById('btn-log').addEventListener('click', async () => {
  const tbody = document.getElementById('log-tbody');
  
  // Show a loading message in the table while it fetches
  tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Loading logs...</td></tr>';
  
  // Open the Bootstrap modal immediately so the user knows something is happening
  const logModal = bootstrap.Modal.getOrCreateInstance(document.getElementById('logModal'));
  logModal.show();

  try {
    // 1. Send GET request to weather.php with your username
    const response = await fetch(`php/weather.php?username=${encodeURIComponent(USERNAME)}`);
    const data = await response.json();

    // 2. Clear the loading message
    tbody.innerHTML = ''; 

    // 3. Populate the table
    if (data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No logs found. (DB might be skipped locally)</td></tr>';
    } else {
      data.forEach(log => {
        // Convert the UNIX timestamp (seconds) from PHP back into a readable Date
        const date = new Date(log.timestamp * 1000);
        const timeString = date.toLocaleString([], { 
          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
        });

        // Create the table row
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${timeString}</td>
          <td>${log.region}</td>
          <td>${log.city}</td>
          <td>${log.country}</td>
        `;
        tbody.appendChild(tr);
      });
    }

  } catch (error) {
    console.error("Error fetching logs:", error);
    tbody.innerHTML = '<tr><td colspan="4" class="text-center text-danger">Failed to load logs.</td></tr>';
  }
});


/**
 * Geocode a location using Nominatim REST API
 * @param {string} query - The location to search for (e.g., "Nicosia, Cyprus")
 * @returns {Promise<Object|null>} - Returns an object with {lat, lon} or null if not found
 */
async function getCoordinates(query) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon),
        displayName: data[0].display_name
      };
    } else {
      console.warn("Nominatim: Location not found.");
      return null;
    }
  } catch (error) {
    console.error("Error fetching coordinates from Nominatim:", error);
    return null;
  }
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

// Keep track of the map and marker layer globally so we can update them later
let weatherMap;
let markerLayer;

/**
 * Updates the OpenLayers map to center on new coordinates and drop a marker
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 */
function updateMapCenter(lat, lon) {
  // 1. Convert standard Lat/Lon to OpenLayers Web Mercator projection
  // WARNING: OpenLayers requires [Longitude, Latitude] order!
  const coords = ol.proj.fromLonLat([lon, lat]);

  if (!weatherMap) {
    // --- CREATE THE MAP (First Search Only) ---

    // Create a vector source and layer for our map marker
    const markerSource = new ol.source.Vector();
    markerLayer = new ol.layer.Vector({ source: markerSource });

    // Initialize the map inside the <div id="map">
    weatherMap = new ol.Map({
      target: 'map',
      layers: [
        // The base map layer (OpenStreetMap)
        new ol.layer.Tile({
          source: new ol.source.OSM()
        }),
        // Our marker layer on top
        markerLayer
      ],
      view: new ol.View({
        center: coords,
        zoom: 12 // Zoom level (12 is good for a city view)
      })
    });
  } else {
    // --- UPDATE THE MAP (Subsequent Searches) ---
    
    // Smoothly pan the map to the new city
    weatherMap.getView().animate({
      center: coords,
      zoom: 12,
      duration: 1000 // 1 second animation
    });
  }

  // --- UPDATE THE MARKER ---
  
  // Create a new point geometry for the marker
  const marker = new ol.Feature({
    geometry: new ol.geom.Point(coords)
  });

  // Style the marker (A nice red circle to match your UI's var(--clr-danger))
  marker.setStyle(new ol.style.Style({
    image: new ol.style.Circle({
      radius: 9,
      fill: new ol.style.Fill({ color: '#ff4d6d' }),
      stroke: new ol.style.Stroke({ color: '#ffffff', width: 2 })
    })
  }));

  // Clear any old markers and add the new one
  markerLayer.getSource().clear();
  markerLayer.getSource().addFeature(marker);
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


async function handleSearch(e) {
  // If e exists, it means it was triggered by an event
  if (e) e.preventDefault(); 
  
  const btn = document.getElementById('btn-search');
  const regionInput = document.getElementById('region-input').value.trim();
  const citySelect = document.getElementById('city-select').value;

  // 1. Basic validation
  if (!regionInput || !citySelect) {
    alert("Please enter both a region and select a city.");
    return;
  }

  // 2. Prevent double-clicks and show loading state
  btn.disabled = true;
  document.getElementById('loading-overlay').classList.add('active');

  try {
    // 3. Save interaction to DB 
    if (typeof saveToDatabase === 'function') {
      saveToDatabase(regionInput, citySelect);
    }

    // 4. Combine inputs and Geocode via Nominatim
    const searchQuery = `${citySelect}, ${regionInput}, Cyprus`; 
    const coords = await getCoordinates(searchQuery);

    if (coords) {
      console.log(`Coordinates found! Lat: ${coords.lat}, Lon: ${coords.lon}`);

      // 5. Un-hide all UI sections FIRST so maps/charts have a valid target size
      document.getElementById('divider-1').classList.remove('hidden');
      document.getElementById('results-section').classList.remove('hidden');
      document.getElementById('divider-2').classList.remove('hidden'); 
      document.getElementById('charts-section').classList.remove('hidden');
      document.getElementById('divider-3').classList.remove('hidden'); 
      document.getElementById('aq-section').classList.remove('hidden');

      // 6. Update Map 
      if (typeof updateMapCenter === 'function') {
        updateMapCenter(coords.lat, coords.lon);
        if (typeof weatherMap !== 'undefined' && weatherMap) {
          setTimeout(() => weatherMap.updateSize(), 100); 
        }
      }

      // 7. Fetch Current Weather & Air Quality
      if (typeof fetchWeather === 'function') fetchWeather(coords.lat, coords.lon);
      if (typeof fetchAirQuality === 'function') fetchAirQuality(coords.lat, coords.lon);

      // 8. Fetch Forecast and display charts 
      if (typeof fetchForecastWeather === 'function' && typeof displayCharts === 'function') {
        const fcData = await fetchForecastWeather(coords.lat, coords.lon);
        displayCharts(fcData, regionInput, citySelect);
      }

    } else {
      alert("Could not find coordinates for that location. Please try again.");
    }
  } catch (err) {
    console.error('Search error:', err);
    alert('An error occurred while fetching data. Please try again.');
  } finally {
    // 9. ALWAYS hide loading overlay and re-enable button
    document.getElementById('loading-overlay').classList.remove('active');
    btn.disabled = false;
  }
}

/**
 * Fetch current weather from OpenWeatherMap and update the DOM
 */
async function fetchWeather(lat, lon) {
  // Use metric units to get Celsius
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OWM_KEY}&units=metric`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Weather data not found");
    const data = await response.json();

    // 1. Extract and round temperatures
    const temp = Math.round(data.main.temp);
    const tempMin = Math.round(data.main.temp_min);
    const tempMax = Math.round(data.main.temp_max);
    const t = data.main.temp;       // Exact temperature in Celsius
    const rh = data.main.humidity;  // Relative humidity percentage

    // Constants for the formula
    const a = 17.27;
    const b = 237.7;
    
    // The calculation
    const alpha = ((a * t) / (b + t)) + Math.log(rh / 100.0);
    const dewPoint = (b * alpha) / (a - alpha);
    
    // 2. Format sunrise and sunset timestamps (Convert Unix UTC to local time)
    const formatTime = (unixTime) => {
      const date = new Date(unixTime * 1000);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    // 3. Update the DOM elements using the IDs from your HTML
    document.getElementById('weather-temp-val').textContent = temp;
    document.getElementById('w-temp-min').textContent = `L:${tempMin}°C`;
    document.getElementById('w-temp-max').textContent = `H:${tempMax}°C`;
    document.getElementById('weather-description').textContent = data.weather[0].description;
    document.getElementById('aq-dew').textContent = Math.round(dewPoint);
    // Grab the high-res 4x icon from OpenWeatherMap
    const iconCode = data.weather[0].icon;
    document.getElementById('weather-icon').src = `https://openweathermap.org/img/wn/${iconCode}@4x.png`;

    // Update the weather table
    document.getElementById('w-pressure').textContent = `${data.main.pressure} hPa`;
    document.getElementById('w-humidity').textContent = `${data.main.humidity}%`;
    document.getElementById('w-wind').textContent = `${data.wind.speed} m/s`;
    document.getElementById('w-clouds').textContent = `${data.clouds.all}%`;
    document.getElementById('w-sunrise').textContent = formatTime(data.sys.sunrise);
    document.getElementById('w-sunset').textContent = formatTime(data.sys.sunset);

  } catch (error) {
    console.error("Error fetching weather:", error);
  }
}

/**
 * Fetch Air Quality Index from AQICN and update the DOM
 */
async function fetchAirQuality(lat, lon) {
  const url = `https://api.waqi.info/feed/geo:${lat};${lon}/?token=${AQICN_KEY}`;
  
  try {
    const response = await fetch(url);
    const json = await response.json();
    
    if (json.status === "ok") {
      const iaqi = json.data.iaqi; // The specific pollutant data
      
      // Update the main AQI score
      document.getElementById('aq-aqi').textContent = json.data.aqi || '--';
      
      // Update individual pollutants (Check if they exist first, as some stations don't track everything)
      document.getElementById('aq-pm25').textContent = iaqi.pm25 ? iaqi.pm25.v : '--';
      document.getElementById('aq-pm10').textContent = iaqi.pm10 ? iaqi.pm10.v : '--';
      document.getElementById('aq-co').textContent = iaqi.co ? iaqi.co.v : '--';
      document.getElementById('aq-no2').textContent = iaqi.no2 ? iaqi.no2.v : '--';
      document.getElementById('aq-o3').textContent = iaqi.o3 ? iaqi.o3.v : '--';
      document.getElementById('aq-so2').textContent = iaqi.so2 ? iaqi.so2.v : '--';
      document.getElementById('aq-dew').textContent = iaqi.d ? iaqi.d.v : '--';
    }
  } catch (error) {
    console.error("Error fetching Air Quality:", error);
  }
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