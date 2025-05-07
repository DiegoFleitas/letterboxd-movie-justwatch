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

  const existingTile = document.querySelector(`div[data-id="${id}"]`);

  if (existingTile) {
    const tileData = STATE.movieTiles[id];
    if (!tileData.movieProviders || !tileData.movieProviders.length)
      tileData.movieProviders = data.movieProviders;
    if (!tileData.poster) tileData.poster = data.poster;
    if (!tileData.link) tileData.link = data.link;
    updateTile(existingTile, tileData);
    updatedTiles[id] = true; // Mark the tile as updated
  } else {
    const tile = document.createElement("div");
    tile.setAttribute("data-id", id);
    tile.classList.add("poster");

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
      }
      streamingProviders[provider.id] = {
        id: provider.id,
        name: provider.name,
        icon: provider.icon,
        urls: [provider.url],
      };
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
    <a href="${link}" target="_blank">
      <img class="spinner" src="spinner-min.svg" alt="Spinner">
      ${
        poster
          ? `<img src="${poster}" onload="hideSpinner(this)" alt="${data.title} Poster">`
          : ""
      }
    </a>
    <div class="poster-info">
      <h2 class="poster-title">${data.title}</h2>
      ${data.year ? `<p class="poster-release-date">Release Date: ${data.year}</p>` : ""}
      <p class="streaming-services" style="display:none">${providerNames.join(
        " / "
      )}</p>
      <div class="poster-providers">
        ${providersElem.innerHTML}
        <div class="tile-icons" data-sp="alternative-search-tile">
          <img onclick="alternativeSearch(event)" src="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🏴‍☠️</text></svg>" alt="alternative search">
        </div>
      </div>
    </div>
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
  Object.values(STATE.movieTiles).forEach((data) => {
    const providerNames = data.movieProviders.map((provider) => provider.name);

    // if the tile has no streaming services, hide it
    if (!providerNames || !providerNames.length) {
      const tile = document.querySelector(`div[data-id="${data.id}"]`);
      tile.style.display = "none";
    } else {
      const includedServices = selectedServices.filter((service) =>
        providerNames.includes(service)
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
