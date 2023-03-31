import {
  streamingProviders,
  updateStreamingProviderIcons,
} from "./streamingProviders.js";
import STATE from "./state.js";

const updatedTiles = {};

export const rebuildMovieMosaic = (title, year, data) => {
  const id = `${year}-${title
    .toUpperCase()
    .replace(/ /g, "-")
    .replace(/[^A-Z0-9]/g, "")}`;

  const existingTile = document.querySelector(`div[data-id="${id}"]`);

  if (existingTile) {
    const tileData = STATE.movieTiles[id];
    if (!tileData.streamingServices || !tileData.streamingServices.length)
      tileData.streamingServices = data.streamingServices;
    if (!tileData.poster) tileData.poster = data.poster;
    if (!tileData.link) tileData.link = data.link;
    updateTile(existingTile, tileData);
    updatedTiles[id] = true; // Mark the tile as updated
  } else {
    const tile = document.createElement("div");
    tile.setAttribute("data-id", id);
    tile.classList.add("poster");

    const streamingServices = data?.streamingServices || [];
    const link = data?.link || "";
    const poster = data?.poster || "";

    const tileData = {
      link,
      streamingServices,
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

  if (data.iconsAndNames && data.iconsAndNames.length) {
    data.iconsAndNames.forEach((provider) => {
      if (streamingProviders[provider.name]) return;
      streamingProviders[provider.name] = provider;
    });
    updateStreamingProviderIcons(Object.values(streamingProviders));
  }
};

const updateTile = (tile, data) => {
  const streamingServices = data?.streamingServices || [];
  const link = data?.link || "";
  const poster = data?.poster || "";
  tile.innerHTML = `
    <a href="${link}" target="_blank">
      <img src="${poster}" alt="${data.title} Poster">
    </a>
    <div class="poster-info">
      <h2 class="poster-title">${data.title}</h2>
      <p class="poster-release-date">Release Date: ${data.year}</p>
      <p class="streaming-services">${streamingServices.join(" / ")}</p>
      <p class="alternative-search" onclick="alternativeSearch(event)">🏴‍☠️</p>
    </div>
  `;
};

// filters by streaming provider
export const filterTiles = () => {
  const activeProviders = document.querySelectorAll("#icons-container .active");

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

  Object.values(STATE.movieTiles).forEach((data) => {
    const streamingServices = data.streamingServices;

    // if the tile has no streaming services, hide it
    if (!streamingServices || !streamingServices.length) {
      const tile = document.querySelector(`div[data-id="${data.id}"]`);
      tile.style.display = "none";
    } else {
      const includedServices = selectedServices.filter((service) =>
        streamingServices.includes(service)
      );
      const tile = document.querySelector(`div[data-id="${data.id}"]`);
      if (includedServices.length > 0) {
        tile.style.display = "";
      } else {
        tile.style.display = "none";
      }
    }
  });
};
