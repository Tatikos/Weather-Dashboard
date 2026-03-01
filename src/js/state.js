/* ================================================================
   js/state.js
   Shared mutable state object.
   Using a single exported object lets all modules read and write
   the same references without circular import issues.
   ================================================================ */

const state = {
  weatherMap:   null,   // OpenLayers map instance
  markerLayer:  null,   // OL vector layer for the location pin
  layerTemp:    null,   // OWM temperature tile layer
  layerPrecip:  null,   // OWM precipitation tile layer
  forecastData: null,   // Cached OWM 5-day forecast API response
};

export default state;