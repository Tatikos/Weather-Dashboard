/* ================================================================
   js/ui/charts.js
   Renders all Plotly charts: three gauge indicators (max values)
   and three line charts (full 5-day trends).
   ================================================================ */

// ── Shared theme tokens (must match _variables.css) ────────────
const PAPER_BG     = 'rgba(0,0,0,0)';
const PLOT_BG      = 'rgba(255,255,255,0.02)';
const FONT_MUTED   = '#a8cfe0';
const FONT_WHITE   = '#ffffff';
const GRID_CLR     = 'rgba(255,255,255,0.06)';
const LINE_CLR     = '#60a5fa';
const GAUGE_MARGIN = { l: 30, r: 30, t: 50, b: 10 };

/**
 * Render gauge + line charts from forecast data.
 *
 * @param {Object} data   - OWM 5-day forecast API response
 * @param {string} region
 * @param {string} city
 */
export function displayCharts(data, region, city) {
  const list      = data.list ?? [];
  const times     = list.map(i => i.dt_txt);
  const temps     = list.map(i => i.main?.temp     ?? null);
  const humids    = list.map(i => i.main?.humidity ?? null);
  const pressures = list.map(i => i.main?.pressure ?? null);

  const maxTemp  = Math.max(...temps.filter(Boolean));
  const maxHumid = Math.max(...humids.filter(Boolean));
  const maxPress = Math.max(...pressures.filter(Boolean));

  renderGauges(maxTemp, maxHumid, maxPress);
  renderLineCharts(times, temps, humids, pressures);
}

// ── Private helpers ─────────────────────────────────────────────

function gaugeTrace(value, title, color, rangeMax) {
  return {
    domain:  { x: [0, 1], y: [0, 1] },
    value,
    title:   { text: title, font: { size: 13, color: FONT_MUTED } },
    type:    'indicator',
    mode:    'gauge+number',
    number:  { font: { color: FONT_WHITE } },
    gauge: {
      axis:    { range: [null, rangeMax], tickwidth: 1, tickcolor: FONT_MUTED },
      bar:     { color },
      bgcolor: 'rgba(255,255,255,0.04)',
    },
  };
}

function renderGauges(maxTemp, maxHumid, maxPress) {
  const layout = {
    margin:        GAUGE_MARGIN,
    height:        230,
    paper_bgcolor: PAPER_BG,
    font:          { color: FONT_MUTED },
  };

  Plotly.newPlot('gauge-temp',
    [gaugeTrace(maxTemp,  'Max Temperature (C)', 'darkblue',  50)],
    layout, { responsive: true });

  Plotly.newPlot('gauge-humidity',
    [gaugeTrace(maxHumid, 'Max Humidity (%)',    'darkred',   100)],
    layout, { responsive: true });

  Plotly.newPlot('gauge-pressure',
    [gaugeTrace(maxPress, 'Max Pressure (hPa)',  'darkgreen', 1100)],
    layout, { responsive: true });
}

function lineLayout(title) {
  return {
    title:         { text: title, font: { size: 13, color: FONT_WHITE } },
    margin:        { l: 50, r: 15, t: 40, b: 55 },
    height:        230,
    paper_bgcolor: PAPER_BG,
    plot_bgcolor:  PLOT_BG,
    font:          { color: FONT_MUTED },
    xaxis:         { color: FONT_MUTED, gridcolor: GRID_CLR, tickfont: { size: 10 } },
    yaxis:         { color: FONT_MUTED, gridcolor: GRID_CLR },
  };
}

function renderLineCharts(times, temps, humids, pressures) {
  const trace = (y) => ({
    x:      times,
    y,
    mode:   'lines+markers',
    line:   { color: LINE_CLR },
    marker: { color: LINE_CLR, size: 4 },
  });

  Plotly.newPlot('chart-temp',
    [trace(temps)],     lineLayout('Temperature (C)'), { responsive: true });

  Plotly.newPlot('chart-humidity',
    [trace(humids)],    lineLayout('Humidity (%)'),    { responsive: true });

  Plotly.newPlot('chart-pressure',
    [trace(pressures)], lineLayout('Pressure (hPa)'),  { responsive: true });
}