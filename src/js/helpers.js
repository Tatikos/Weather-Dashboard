/* ================================================================
   js/helpers.js
   Pure utility functions — no DOM access, no side effects.
   ================================================================ */

import { MONTHS } from './config.js';

/**
 * Converts a Unix timestamp (seconds) to "YYYY-MM-DD HH:MM"
 * using the browser's local timezone.
 * Used in the forecast table rows.
 *
 * @param {number} unixSec
 * @returns {string}
 */
export function formatLocalDateTime(unixSec) {
  const d  = new Date(unixSec * 1000);
  const Y  = d.getFullYear();
  const Mo = String(d.getMonth() + 1).padStart(2, '0');
  const D  = String(d.getDate()).padStart(2, '0');
  const H  = String(d.getHours()).padStart(2, '0');
  const Mi = String(d.getMinutes()).padStart(2, '0');
  return `${Y}-${Mo}-${D} ${H}:${Mi}`;
}

/**
 * Converts a Unix timestamp (seconds) to "D Mon YYYY HH:MM"
 * Used in the forecast detail modal title.
 *
 * @param {number} unixSec
 * @returns {string}
 */
export function formatModalDateTime(unixSec) {
  const d  = new Date(unixSec * 1000);
  const D  = d.getDate();
  const Mo = MONTHS[d.getMonth()];
  const Y  = d.getFullYear();
  const H  = String(d.getHours()).padStart(2, '0');
  const Mi = String(d.getMinutes()).padStart(2, '0');
  return `${D} ${Mo} ${Y} ${H}:${Mi}`;
}

/**
 * Formats a Unix timestamp (seconds) to "HH:MM" local time.
 * Used for sunrise / sunset display.
 *
 * @param {number} unixSec
 * @returns {string}
 */
export function formatTime(unixSec) {
  return new Date(unixSec * 1000)
    .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}