/* ================================================================
   js/main.js  —  Application entry point
   
   Responsibilities:
     - Auth Session Management
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

// ── AUTHENTICATION DOM & LOGIC ──────────────────────────────────
const authModalEl = document.getElementById('authModal');
const authModal = authModalEl ? new bootstrap.Modal(authModalEl) : null;
const authForm = document.getElementById('auth-form');
const toggleLogin = document.getElementById('toggleLogin');
const toggleRegister = document.getElementById('toggleRegister');
const authError = document.getElementById('auth-error');
const btnLogout = document.getElementById('btn-logout');

// UI Toggles for Login vs Register
if (toggleLogin && toggleRegister) {
  toggleLogin.addEventListener('change', () => {
    document.getElementById('group-displayname').classList.add('hidden');
    document.getElementById('group-email').classList.add('hidden');
    document.getElementById('btn-auth-submit').textContent = 'Login';
    document.getElementById('authModalTitle').textContent = 'Login';
    authError.classList.add('hidden');
  });
  toggleRegister.addEventListener('change', () => {
    document.getElementById('group-displayname').classList.remove('hidden');
    document.getElementById('group-email').classList.remove('hidden');
    document.getElementById('btn-auth-submit').textContent = 'Register';
    document.getElementById('authModalTitle').textContent = 'Register';
    authError.classList.add('hidden');
  });
}

// Handle Form Submission
if (authForm) {
  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const isRegister = toggleRegister.checked;
    const action = isRegister ? 'register' : 'login';
    
    const payload = {
      user_name: document.getElementById('auth-username').value.trim(),
      password: document.getElementById('auth-password').value,
    };
    if (isRegister) {
      payload.display_name = document.getElementById('auth-displayname').value.trim();
      payload.email = document.getElementById('auth-email').value.trim();
    }

    try {
      const res = await fetch(`php/auth.php?action=${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.status === 'success') {
        authModal.hide();
        checkAuthStatus(); // Refresh UI
      } else {
        authError.textContent = data.message;
        authError.classList.remove('hidden');
      }
    } catch (err) {
      console.error("Auth error:", err);
    }
  });
}

// Check if logged in on page load
async function checkAuthStatus() {
  try {
    const res = await fetch('php/auth.php?action=status');
    const data = await res.json();
    
    if (data.logged_in) {
      // Overwrite global environment username so logs save to this user
      window.ENV.USERNAME = data.user_name; 
      
      document.getElementById('user-display').classList.remove('hidden');
      document.getElementById('user-name-text').textContent = data.display_name;
      document.getElementById('btn-auth').classList.add('hidden');
      document.getElementById('btn-logout').classList.remove('hidden');
    } else {
      document.getElementById('user-display').classList.add('hidden');
      document.getElementById('btn-auth').classList.remove('hidden');
      document.getElementById('btn-logout').classList.add('hidden');
    }
  } catch (err) {
    console.warn("Could not check auth status");
  }
}

// Handle Logout
if (btnLogout) {
  btnLogout.addEventListener('click', async () => {
    await fetch('php/auth.php?action=logout', { method: 'POST' });
    window.location.reload(); // Reload page to clear sensitive data
  });
}

// ── Init ─────────────────────────────────────────────────────────
btnSearch.addEventListener('click', handleSearch);
btnClear.addEventListener('click', clearAll);
initLogModal();
checkAuthStatus(); // Run auth check immediately

// ── Validation ───────────────────────────────────────────────────
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

    showAllSections(region, city);

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