/* ================================================================
   js/ui/map.js
   OpenLayers map management.
   Creates the map on first call, smoothly pans on subsequent
   calls, and always drops a styled pin at the searched location.
   ================================================================ */

import { OWM_KEY } from '../config.js';
import state from '../state.js';

/**
 * Create (first search) or animate-pan (subsequent searches) the
 * OpenLayers map to the given coordinate.
 * Adds OWM temperature + precipitation tile layers on creation.
 * Drops a styled red pin marker on every call.
 *
 * @param {number} lat
 * @param {number} lon
 */
export function updateMapCenter(lat, lon) {
  const coords = ol.proj.fromLonLat([lon, lat]);

  if (!state.weatherMap) {
    // ── First search: build the full map ──────────────────────
    const markerSource = new ol.source.Vector();
    state.markerLayer  = new ol.layer.Vector({ source: markerSource });

    state.layerTemp = new ol.layer.Tile({
      source: new ol.source.XYZ({
        url: `https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=${OWM_KEY}`,
      }),
      opacity: 0.5,
    });

    state.layerPrecip = new ol.layer.Tile({
      source: new ol.source.XYZ({
        url: `https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${OWM_KEY}`,
      }),
      opacity: 0.5,
    });

    state.weatherMap = new ol.Map({
      target: 'map',
      layers: [
        new ol.layer.Tile({ source: new ol.source.OSM() }),
        state.layerTemp,
        state.layerPrecip,
        state.markerLayer,
      ],
      view: new ol.View({ center: coords, zoom: 5 }),
    });

    // Force correct dimensions after the section becomes visible
    setTimeout(() => state.weatherMap.updateSize(), 100);

  } else {
    // ── Subsequent searches: animate pan ─────────────────────
    state.weatherMap.getView().animate({ center: coords, zoom: 5, duration: 800 });
  }

  // ── Drop pin at searched location ────────────────────────────
  const marker = new ol.Feature({ geometry: new ol.geom.Point(coords) });
  marker.setStyle(new ol.style.Style({
    image: new ol.style.Circle({
      radius: 9,
      fill:   new ol.style.Fill({ color: '#ff4d6d' }),
      stroke: new ol.style.Stroke({ color: '#ffffff', width: 2 }),
    }),
  }));

  state.markerLayer.getSource().clear();
  state.markerLayer.getSource().addFeature(marker);
}