/* ================================================================
   js/api/airquality.js
   ================================================================ */

import { AQICN_KEY } from '../config.js';

export async function fetchAirQuality(lat, lon) {
  const url = `https://api.waqi.info/feed/geo:${lat};${lon}/?token=${AQICN_KEY}`;

  try {
    const res  = await fetch(url);
    const json = await res.json();

    if (json.status !== 'ok') {
      console.warn('[airquality] AQICN returned non-ok status:', json.status);
      return;
    }

    const iaqi = json.data.iaqi;

    setAQ('aq-aqi',  json.data.aqi);
    setAQ('aq-pm25', iaqi.pm25?.v);
    setAQ('aq-pm10', iaqi.pm10?.v);
    setAQ('aq-co',   iaqi.co?.v);
    setAQ('aq-no2',  iaqi.no2?.v);
    setAQ('aq-o3',   iaqi.o3?.v);
    setAQ('aq-so2',  iaqi.so2?.v);

    const dewEl = document.getElementById('aq-dew');
    if (!dewEl.textContent || dewEl.textContent === '--') {
      setAQ('aq-dew', iaqi.dew?.v);
    }

  } catch (err) {
    console.error('[airquality] Fetch failed:', err);
  }
}

function setAQ(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = (val !== undefined && val !== null) ? val : '--';
}