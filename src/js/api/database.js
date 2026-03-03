/* ================================================================
   js/api/database.js
   Thin wrappers around weather.php for saving and retrieving
   search log entries.
   ================================================================ */

import { PHP_FILE } from '../config.js';

/**
 * POST a search event to weather.php.
 * Fire-and-forget — awaiting is optional.
 *
 * @param {string} region
 * @param {string} city
 * @param {string} country
 */
export async function saveToDatabase(region, city, country = 'Cyprus') {
  const currentUser = window.ENV?.USERNAME || 'student_test';

  try {
    const res = await fetch(PHP_FILE, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        username: currentUser,
        region: region.substring(0, 15),
        city: city.substring(0, 15),
        country: country.substring(0, 20),
      }),
    });

    if (res.status === 201) {
      console.log('[database] Save successful!');
    } else {
      console.warn('[database] Unexpected response:', res.status, await res.text());
    }
  } catch (err) {
    console.warn('[database] POST failed (expected if no VPN):', err.message);
  }
}

/**
 * GET the last 5 search log entries for the configured username.
 *
 * @returns {Promise<Array>} Array of { timestamp, region, city, country }
 */
export async function fetchLogs() {
  const currentUser = window.ENV?.USERNAME || 'student_test';
  
  const url = `${PHP_FILE}?username=${encodeURIComponent(currentUser)}`;
  const res = await fetch(url);

  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  return res.json();
}