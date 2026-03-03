/* ================================================================
   js/api/countries.js
   Fetches countries and their cities from CountriesNow API.
   ================================================================ */

let globalCountryData = [];

export async function loadCountries() {
  const countrySelect = document.getElementById('country-select');
  const citySelect = document.getElementById('city-select');
  if (!countrySelect || !citySelect) return;

  try {
    const res = await fetch('https://countriesnow.space/api/v0.1/countries');
    const json = await res.json();
    
    if (!json.error) {
      globalCountryData = json.data;
      
      globalCountryData.sort((a, b) => a.country.localeCompare(b.country));

      countrySelect.innerHTML = '<option value="" disabled selected>Select a Country</option>';
      
      globalCountryData.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.country;
        opt.textContent = c.country;
        countrySelect.appendChild(opt);
      });
      countrySelect.addEventListener('change', (e) => {
        const selectedCountry = e.target.value;
        populateCities(selectedCountry);
      });
      countrySelect.value = 'Cyprus';
      populateCities('Cyprus');
    }
  } catch (err) {
    console.error("Failed to load countries:", err);
    countrySelect.innerHTML = '<option value="Cyprus" selected>Cyprus (Fallback)</option>';
  }
}

function populateCities(countryName) {
  const citySelect = document.getElementById('city-select');
  citySelect.innerHTML = '<option value="" disabled selected>Select a city...</option>';
  if (countryName === 'Cyprus') {
    const cyprusCities = ['Nicosia', 'Limassol', 'Larnaca', 'Paphos', 'Famagusta', 'Kyrenia'].sort();
    
    cyprusCities.forEach(city => {
      const opt = document.createElement('option');
      opt.value = city;
      opt.textContent = city;
      citySelect.appendChild(opt);
    });
    
    citySelect.disabled = false;
    return;
  }

  // ── STANDARD: Use the API list for the rest of the world ──
  const countryObj = globalCountryData.find(c => c.country === countryName);
  
  if (countryObj && countryObj.cities.length > 0) {
    const cities = countryObj.cities.sort();
    
    cities.forEach(city => {
      const opt = document.createElement('option');
      opt.value = city;
      opt.textContent = city;
      citySelect.appendChild(opt);
    });
    citySelect.disabled = false; 
  } else {
    citySelect.innerHTML = '<option value="" disabled selected>No cities found</option>';
    citySelect.disabled = true;
  }
}