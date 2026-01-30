import {
  streamingProviders,
  updateStreamingProviderIcons,
  updateTileProviders,
} from "./streamingProviders.js";
import STATE from "./state.js";

const updatedTiles = {};

export const rebuildMovieMosaic = (title, year, data) => {
  const id = `${year}-${title
    .toUpperCase()
    .replace(/ /g, "-")
    .replace(/[^A-Z0-9]/g, "")}`;

  // First check if tile already exists in STATE (faster than DOM search)
  let existingTile = null;
  let existingId = id;
  
  // Check if we have this tile in STATE already
  if (STATE.movieTiles[id]) {
    // We have it, now find the DOM element
    existingTile = document.querySelector(`div[data-id="${id}"]`);
  } else if (data?.link) {
    // Not found by ID, try to find by link in STATE
    const linkToMatch = data.link.startsWith('http') ? data.link : `https://letterboxd.com${data.link}`;
    
    // Search STATE for existing tile with this link
    for (const [stateId, tileData] of Object.entries(STATE.movieTiles)) {
      if (tileData.link === linkToMatch) {
        existingId = stateId;
        existingTile = document.querySelector(`div[data-id="${stateId}"]`);
        
        // Update the ID if it changed
        if (existingId !== id) {
          if (existingTile) {
            existingTile.setAttribute('data-id', id);
          }
          STATE.movieTiles[id] = STATE.movieTiles[existingId];
          delete STATE.movieTiles[existingId];
        }
        break;
      }
    }
    
    // If still not found in STATE, try DOM search as fallback
    if (!existingTile) {
      existingTile = document.querySelector(`div[data-letterboxd-link="${linkToMatch}"]`);
      if (existingTile) {
        const oldId = existingTile.getAttribute('data-id');
        existingTile.setAttribute('data-id', id);
        if (oldId && oldId !== id && STATE.movieTiles[oldId]) {
          STATE.movieTiles[id] = STATE.movieTiles[oldId];
          delete STATE.movieTiles[oldId];
        }
      }
    }
  } else {
    // No link provided, try DOM search by ID
    existingTile = document.querySelector(`div[data-id="${id}"]`);
  }
  
  // Fallback: if not found by year-title or link, try finding by title only (for year mismatches)
  if (!existingTile) {
    const titleId = title.toUpperCase().replace(/ /g, "-").replace(/[^A-Z0-9]/g, "");
    const allTiles = document.querySelectorAll('.poster[data-id]');
    for (const tile of allTiles) {
      const tileId = tile.getAttribute('data-id');
      if (tileId && tileId.endsWith(titleId)) {
        existingTile = tile;
        // Update the tile's ID to the correct one
        tile.setAttribute('data-id', id);
        // Update STATE reference
        const oldData = STATE.movieTiles[tileId];
        if (oldData) {
          delete STATE.movieTiles[tileId];
          STATE.movieTiles[id] = oldData;
        }
        break;
      }
    }
  }

  if (existingTile) {
    const tileData = STATE.movieTiles[id];
    
    // If tileData doesn't exist under new ID, it might be under old ID
    if (!tileData) {
      console.log(`[rebuildMovieMosaic] Tile not found in STATE under ID "${id}", checking for old IDs`);
      const oldId = existingTile.getAttribute('data-id');
      if (oldId && oldId !== id && STATE.movieTiles[oldId]) {
        console.log(`[rebuildMovieMosaic] Found tile in STATE under old ID "${oldId}", moving to "${id}"`);
        STATE.movieTiles[id] = STATE.movieTiles[oldId];
        delete STATE.movieTiles[oldId];
      } else {
        console.log(`[rebuildMovieMosaic] Could not find tile in STATE, creating new entry`);
        STATE.movieTiles[id] = {
          id,
          title,
          year,
          link: data.link,
          movieProviders: [],
          poster: null
        };
      }
    }
    
    const currentTileData = STATE.movieTiles[id];
    // Always update providers if data includes it (even if empty array)
    if (data.hasOwnProperty('movieProviders')) {
      currentTileData.movieProviders = data.movieProviders || [];
    }
    // Update poster if new one is provided and not a placeholder
    if (data.poster && data.poster !== "/movie_placeholder.svg") {
      currentTileData.poster = data.poster;
    } else if (data.poster && !currentTileData.poster) {
      currentTileData.poster = data.poster;
    }
    if (data.link && !currentTileData.link) currentTileData.link = data.link;
    if (!currentTileData.year) currentTileData.year = year; // Update year if it was missing
    updateTile(existingTile, currentTileData);
    updatedTiles[id] = true; // Mark the tile as updated
  } else {
    const tile = document.createElement("div");
    tile.setAttribute("data-id", id);
    tile.classList.add("poster");
    
    // Store Letterboxd link for duplicate detection
    if (data?.link) {
      tile.setAttribute("data-letterboxd-link", data.link);
    }

    const movieProviders = data?.movieProviders || [];
    const link = data?.link || "";
    const poster = data?.poster || "";

    const tileData = {
      link,
      movieProviders,
      poster,
      title,
      year,
      id,
    };

    STATE.movieTiles[id] = tileData; // Store the tile data
    updateTile(tile, tileData);
    updatedTiles[id] = true; // Mark the tile as updated

    var moviesContainer = document.querySelector(".poster-showcase");
    moviesContainer.appendChild(tile);
  }

  // collect providers
  if (data.movieProviders && data.movieProviders.length) {
    data.movieProviders.forEach((provider) => {
      if (streamingProviders[provider.id]) {
        streamingProviders[provider.id].urls.push(provider.url);
      } else {
        streamingProviders[provider.id] = {
          id: provider.id,
          name: provider.name,
          icon: provider.icon,
          urls: [provider.url],
        };
      }
    });

    updateStreamingProviderIcons(streamingProviders);
  }
};

const updateTile = (tile, data) => {
  const movieProviders = data?.movieProviders || [];
  const link = data?.link || "";
  const poster = data?.poster;
  // Add providers icons to the tile
  const providersElem = updateTileProviders(data);
  const providerNames = movieProviders.map((provider) => provider.name);
  tile.innerHTML = `
    <a href="${link}" class="poster-link" target="_blank" tabindex="0" aria-label="${data.title} (${data.year})">
      ${
        poster
          ? `<img class="spinner" src="spinner-min.svg" alt="Loading...">` +
            `<img src="${poster}" onload="hideSpinner(this)" alt="${data.title} Poster">`
          : `<div class="poster-skeleton"></div>`
      }
      <div class="poster-gradient"></div>
      <div class="poster-info">
        <h2 class="poster-title">${data.title}</h2>
        ${data.year ? `<p class="poster-release-date">${data.year}</p>` : ""}
        <p class="streaming-services" style="display:none">${providerNames.join(" / ")}</p>
        <div class="poster-providers">
          ${providersElem.innerHTML}
          <div class="tile-icons" data-sp="alternative-search-tile">
            <img onclick="alternativeSearch(event)" src="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🏴‍☠️</text></svg>" alt="alternative search">
          </div>
        </div>
      </div>
    </a>
  `;
  const proxy = "https://click.justwatch.com/a?r=";
  tile.querySelectorAll("[data-url]").forEach((element) => {
    const url = element.getAttribute("data-url");
    element.addEventListener("click", () => {
      window.open(`${proxy}${url}`, "_blank");
    });
  });
};

// filters by streaming provider
export const filterTiles = () => {
  const activeProviders = document.querySelectorAll(
    "#icons-container-main .active"
  );

  if (!activeProviders || !activeProviders.length) {
    // display all tiles
    document.querySelectorAll(".poster").forEach((tile) => {
      tile.style.display = "";
    });
    return;
  }

  const selectedServices = Array.from(activeProviders).map(
    (elem) => elem.dataset.sp
  );

  // iterate through tiles checking if they have the selected streaming services
  Object.entries(STATE.movieTiles).forEach(([id, data]) => {
    const providerNames = data.movieProviders ? data.movieProviders.map((provider) => provider.name) : [];

    // if the tile has no streaming services, hide it
    if (!providerNames || !providerNames.length) {
      const tile = document.querySelector(`div[data-id="${id}"]`);
      if (tile) {
        tile.style.display = "none";
      }
    } else {
      const includedServices = selectedServices.filter((service) =>
        providerNames.includes(service)
      );
      const tile = document.querySelector(`div[data-id="${id}"]`);
      if (tile) {
        if (includedServices.length > 0) {
          tile.style.display = "";
        } else {
          tile.style.display = "none";
        }
      }
    }
  });
};
