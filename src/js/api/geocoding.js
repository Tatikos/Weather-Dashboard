/* ================================================================
   js/api/geocoding.js
   Resolves a city + region string to { lat, lon }.
   Strategy: Nominatim (primary) → OWM geocoding (fallback).
   ================================================================ */

import { OWM_KEY } from '../config.js';

/**
 * Geocode a Cyprus city + region to lat/lon coordinates.
 * Tries Nominatim first; falls back to OpenWeatherMap's
 * /geo/1.0/direct endpoint if Nominatim returns no results
 * or throws (e.g. rate-limited by CORS policy).
 *
 * @param {string} city   - Selected city name
 * @param {string} region - User-entered region
 * @returns {Promise<{lat: number, lon: number} | null>}
 */
export async function getCoordinates(city, region) {
  // ── 1. Nominatim (primary) ──────────────────────────────────
  const nominatimUrl =
    `https://nominatim.openstreetmap.org/search` +
    `?q=${encodeURIComponent(city)},${encodeURIComponent(region)},Cyprus` +
    `&format=json&limit=1`;

  try {
    const res  = await fetch(nominatimUrl);
    const data = await res.json();

    if (data && data.length > 0) {
      console.log('[geocoding] Resolved via Nominatim.');
      return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    }
  } catch (err) {
    console.warn('[geocoding] Nominatim failed, trying OWM fallback.', err);
  }

  // ── 2. OpenWeatherMap geocoding (fallback) ──────────────────
  const owmUrl =
    `https://api.openweathermap.org/geo/1.0/direct` +
    `?q=${encodeURIComponent(city)},CY&limit=1&appid=${OWM_KEY}`;

  try {
    const res  = await fetch(owmUrl);
    const data = await res.json();

    if (data && data.length > 0) {
      console.log('[geocoding] Resolved via OWM fallback.');
      return { lat: data[0].lat, lon: data[0].lon };
    }
  } catch (err) {
    console.error('[geocoding] OWM fallback also failed.', err);
  }

  return null;
}