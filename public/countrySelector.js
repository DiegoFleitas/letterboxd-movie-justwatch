
// Custom Country Selector Dropdown
// Usage: Add <div id="country-selector"></div> where you want the selector
// and include this script after the DOM loads.


import { countries as importedCountries } from './src/countries.js';


// Adapt importedCountries to expected format for this selector
const countries = importedCountries.map(c => ({
  code: c.id.split('_')[1],
  name: c.text,
  flag: `https://www.justwatch.com/static/compile_jw/assets/flags/${c.id.split('_')[1]}.png`,
  selected: c.selected || false
}));

let selectedCountry = countries.find(c => c.selected) || countries.find(c => c.code === 'UY');

function renderCountrySelector() {
  const container = document.getElementById('country-selector');
  if (!container) return;

  container.innerHTML = `
    <div class="country-selected" tabindex="0">
      <img src="${selectedCountry.flag}" alt="${selectedCountry.code}" class="country-flag">
      <span class="country-name">${selectedCountry.name}</span>
      <span class="country-arrow">▼</span>
    </div>
    <div class="country-modal" style="display:none;">
      <div class="country-modal-header">Elige tu país</div>
      <input type="search" class="country-search" placeholder="Buscar país...">
      <div class="country-list">
        ${countries.map(c => `
          <div class="country-list-item${c.code === selectedCountry.code ? ' selected' : ''}" data-code="${c.code}">
            <img src="${c.flag}" alt="${c.code}" class="country-flag">
            <span class="country-name">${c.name}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  // Event listeners
  const selectedDiv = container.querySelector('.country-selected');
  const modal = container.querySelector('.country-modal');
  selectedDiv.onclick = () => {
    modal.style.display = 'block';
    container.classList.add('open');
    container.querySelector('.country-search').focus();
  };
  document.addEventListener('click', (e) => {
    if (!container.contains(e.target)) {
      modal.style.display = 'none';
      container.classList.remove('open');
    }
  });
  container.querySelector('.country-search').oninput = function() {
    const val = this.value.toLowerCase();
    container.querySelectorAll('.country-list-item').forEach(item => {
      const name = item.querySelector('.country-name').textContent.toLowerCase();
      item.style.display = name.includes(val) ? '' : 'none';
    });
  };
  container.querySelectorAll('.country-list-item').forEach(item => {
    item.onclick = function() {
      const code = this.getAttribute('data-code');
      selectedCountry = countries.find(c => c.code === code);
      modal.style.display = 'none';
      container.classList.remove('open');
      renderCountrySelector();
    };
  });
}

document.addEventListener('DOMContentLoaded', renderCountrySelector);

// To get the selected country elsewhere, use selectedCountry
