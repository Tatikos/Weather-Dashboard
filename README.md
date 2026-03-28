# EPL425: Internet Technologies - Assignment 1
**Advanced Weather and Air Quality Dashboard**

**Live URL:** `https://students.cs.ucy.ac.cy/~gfotio01/epl425/`  

---

## 1. Project Overview
This project is an advanced, fully responsive web application that provides real-time meteorology data, 5-day forecasts, and air quality metrics. It features a modern, modular architecture utilizing ES6 JavaScript modules on the frontend and a secure, session-managed PHP middleware backend connected to the UCY MySQL database.

---

## 2. Core Requirements Implemented
- **Geocoding:** Converts City/Region into coordinates via Nominatim API, with a seamless fallback to the OpenWeatherMap Geocoding API if rate-limited.
- **Current Weather:** Fetches real-time data from OpenWeatherMap and calculates the exact Dew Point using the Magnus approximation formula.
- **Forecast & Charts:** Retrieves 5-day forecast data and visualizes it using **Plotly.js** (Gauge indicators for temperature extremes, Line charts for 5-day trends).
- **Interactive Maps:** Integrates **OpenLayers** with standard OSM tiles, overlaid with dynamic Temperature and Precipitation map tiles from OWM.
- **Air Quality:** Integrates the WAQI (AQICN) API to display specific pollutant levels (PM2.5, PM10, CO, NO2, O3, SO2).
- **Database Logging:** Saves user search interactions to the UCY MySQL database (`requests` table) via a secure PHP script.
- **View Logs:** Retrieves and displays the last 5 searches in a Bootstrap modal, parsing UNIX timestamps into localized, readable dates.

---

## 3. Bonus Features Implemented (Advanced Functionality)

### 🏆 Bonus 1: User Login & Registration System
Built a complete authentication system matching the assignment's bonus criteria.
- **Secure Backend:** Uses PHP `session_start()` for state management and `password_hash()` / `password_verify()` for industry-standard credential security. 
- **Dynamic UI:** A seamless Bootstrap modal handles both Login and Registration toggling.
- **Personalized Logging:** Once logged in, the application dynamically overwrites the global environment username, ensuring all database logs are saved to the authenticated user's account and updates their `last_login` timestamp.

### 🏆 Bonus 2: Dynamic Countries & Cities API
Upgraded the static search form to support global geographic searches using the **CountriesNow API**.
- **Global Search:** Dynamically fetches all countries and their respective cities on page load.
- **Cyprus Interceptor:** To strictly satisfy the assignment requirements, a JavaScript interceptor detects if "Cyprus" is selected and artificially forces the City dropdown to *only* display the 6 main Cypriot districts. For all other countries, it uses the global API list.

### 🏆 Bonus 3: HTML5 Geolocation (Auto-Locate)
Added an "Auto-Locate Me" button that uses the browser's native Geolocation API to request the user's current coordinates. It then uses OpenWeatherMap's **Reverse Geocoding** API to automatically fill in the Region and City inputs, dynamically creating the dropdown option if the localized spelling differs from the API list.

### 🏆 Bonus 4: Enterprise CI/CD Pipeline
Implemented a 3-stage GitHub Actions workflow (`.github/workflows/ci-cd.yml`):
1. **Validation:** Checks project directory structure and enforces file naming conventions.
2. **Linting:** Scans all PHP files for fatal syntax errors.
3. **Security:** Runs the Anchore Gripe vulnerability scanner to detect security flaws, then packages the application via a custom `Dockerfile`.

### 🏆 Bonus 5: One-Click "Search Again" from History
Users can instantly re-run previous searches directly from their database logs. Next to each entry in the "Last 5 requests" modal, a "Search Again" button seamlessly orchestrates a complex UI automation sequence:
1. Closes the modal.
2. Changes the Country dropdown to the historical value, artificially dispatching a `change` event to force the CountriesNow API to fetch the relevant foreign cities.
3. Automatically selects the correct historical City and Region.
4. Programmatically triggers the main Search button to execute a fresh API data retrieval cycle.

---

## 4. Database Optimization & Safeties
**Global Search Truncation:** The original UCY database schema limits the `region` and `city` columns to `VARCHAR(15)`. To prevent MySQL from crashing when searching for global cities with long names (e.g., "San Francisco", "Rio de Janeiro"), the `database.js` file intelligently truncates all geographic strings to fit the strict database limits before executing the POST request.

**Graceful Degradation:** The PHP backend is engineered to detect when it cannot reach the UCY database (e.g., when the developer is disconnected from the University VPN). Instead of crashing the frontend with 500 Internal Server Errors, it falls back to a mock local session, returning 200/201 HTTP codes so the UI and APIs can be tested seamlessly offline.

---
