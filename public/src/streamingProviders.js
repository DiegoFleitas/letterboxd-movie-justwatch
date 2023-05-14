import { filterTiles } from "./movieTiles.js";

export const streamingProviders = {};

export const updateStreamingProviderIcons = (streamingProviders) => {
  // Select the container for the streaming provider icons
  const spIconsContainer = document.querySelector("#icons-container-main");
  spIconsContainer.innerHTML = "";

  // Loop through each streaming provider
  for (const id in streamingProviders) {
    const provider = streamingProviders[id];

    // Create a new streaming provider icon
    const spIcon = createStreamingProviderIcon(provider);

    // Add the streaming provider icon to the container
    spIconsContainer.appendChild(spIcon);
  }
};

const createStreamingProviderIcon = (provider) => {
  // Create a new streaming provider icon
  const spIcon = document.createElement("div");
  spIcon.classList.add("streaming-provider-icon");
  spIcon.dataset.sp = provider.name;

  // Create a new streaming provider icon image
  const spIconImage = document.createElement("img");
  spIconImage.src = provider.icon;
  spIconImage.alt = provider.name;
  spIconImage.addEventListener("click", (event) => {
    event.target.parentElement.classList.toggle("active");
    filterTiles();
  });

  // Add the streaming provider icon image to the streaming provider icon
  spIcon.appendChild(spIconImage);

  return spIcon;
};

export const updateTileProviders = (tileData) => {
  const providersContainer = document.createElement("div");
  providersContainer.classList.add("icons-container", "icons-container-tile");
  // Add streaming provider icons to the tile
  for (const id in tileData.movieProviders) {
    const provider = tileData.movieProviders[id];
    const spIcon = createTileProvidersIcon(provider);
    providersContainer.appendChild(spIcon);
  }
  return providersContainer;
};

// tile icons should link to the streaming service whenever possible
export const createTileProvidersIcon = (provider) => {
  // Create a new streaming provider icon
  const spIcon = document.createElement("div");
  spIcon.classList.add("tile-icons");
  spIcon.dataset.sp = provider.name;

  // Create a new streaming provider icon image
  const spIconImage = document.createElement("img");
  spIconImage.classList.add("tile-icons");
  spIconImage.src = provider.icon;
  spIconImage.alt = provider.name;
  spIcon.dataset["url"] = provider.url;

  // Add the streaming provider icon image to the streaming provider icon
  spIcon.appendChild(spIconImage);

  return spIcon;
};
