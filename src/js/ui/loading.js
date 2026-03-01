/* ================================================================
   js/ui/loading.js
   Controls the full-screen loading overlay.
   ================================================================ */

const overlay = document.getElementById('loading-overlay');

/** Show the full-screen loading overlay. */
export function showLoading() {
  overlay.classList.add('active');
}

/** Hide the full-screen loading overlay. */
export function hideLoading() {
  overlay.classList.remove('active');
}