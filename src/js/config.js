/* ================================================================
   js/config.js
   Global constants. API keys are injected into window.ENV by
   php/env.php on the CS server. For local dev, fill in .env.local
   and the PHP server picks them up automatically.
   ================================================================ */

export const OWM_KEY   = window.ENV?.OWM_KEY   || '';
export const AQICN_KEY = window.ENV?.AQICN_KEY || '';
export const USERNAME  = window.ENV?.USERNAME  || 'student_test';
export const PHP_FILE  = 'php/weather.php';

export const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];