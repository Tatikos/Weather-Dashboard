import { OWM_KEY } from '../config.js';

export async function getCoordinates(city, region, country) {
  // Primary: Nominatim
  const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)},${encodeURIComponent(region)},${encodeURIComponent(country)}&format=json&limit=1`;

  try {
    const nomRes = await fetch(nominatimUrl);
    if (nomRes.ok) {
      const nomData = await nomRes.json();
      if (nomData && nomData.length > 0) {
        return { lat: parseFloat(nomData[0].lat), lon: parseFloat(nomData[0].lon) };
      }
    }
  } catch (err) {
    console.warn("Nominatim failed. Switching to fallback...");
  }

  // Fallback: OpenWeatherMap
  const owmUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)},${encodeURIComponent(region)}&limit=1&appid=${OWM_KEY}`;
  try {
    const owmRes = await fetch(owmUrl);
    if (owmRes.ok) {
      const owmData = await owmRes.json();
      if (owmData && owmData.length > 0) {
        return { lat: owmData[0].lat, lon: owmData[0].lon };
      }
    }
  } catch (err) {
    console.error("Fallback also failed:", err);
  }
  return null;
}

export async function reverseGeocode(lat, lon) {
  const url = `https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${OWM_KEY}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Reverse geocoding failed");
    const data = await res.json();
    if (data && data.length > 0) {
      return {
        city: data[0].name,
        region: data[0].state || data[0].name
      };
    }
  } catch (err) {
    console.error(err);
  }
  return null;
}