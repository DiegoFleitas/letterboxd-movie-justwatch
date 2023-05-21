import { filterTiles } from "./movieTiles.js";

export const streamingProviders = {};

export const updateStreamingProviderIcons = (streamingProviders) => {
  // Select the container for the streaming provider icons
  const spIconsContainer = document.querySelector("#icons-container-main");
  spIconsContainer.innerHTML = "";

  const keys = Object.keys(streamingProviders);
  // Loop through each streaming provider
  for (let i = 0; i < keys.length; i++) {
    const id = keys[i];
    const provider = streamingProviders[id];

    // Create a new streaming provider icon
    const spIcon = createStreamingProviderIcon(provider);

    // Add the streaming provider icon to the container
    spIconsContainer.appendChild(spIcon);

    // Call createAltSearchIcon on the last iteration
    if (i === keys.length - 1) {
      const altIcon = createAltSearchIcon();
      spIconsContainer.appendChild(altIcon);
    }
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

const createAltSearchIcon = () => {
  // Create a new streaming provider icon
  const spIcon = document.createElement("div");
  spIcon.classList.add("streaming-provider-icon");
  spIcon.dataset.sp = "alternative search";

  // Create a new streaming provider icon image
  const spIconImage = document.createElement("img");
  spIconImage.src = "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🏴‍☠️</text></svg>";
  spIconImage.alt = "alternative Search";
  spIconImage.addEventListener("click", (event) => {
    const clickedElement = event.target.parentElement;
    clickedElement.classList.toggle("active");
  
    // Determine whether the clicked element is now active
    const isActive = clickedElement.classList.contains("active");
  
    // Select all tiles with more than one provider
    const xpath = "//div[@class='poster' and .//div[@class='poster-providers' and count(.//div[@class='tile-icons']) > 1]]";
    const result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
  
    for (let i = 0; i < result.snapshotLength; i++) {
      // If the clicked element is active, hide the other tiles; otherwise, show them
      result.snapshotItem(i).style.display = isActive ? "none" : "";
    }
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
