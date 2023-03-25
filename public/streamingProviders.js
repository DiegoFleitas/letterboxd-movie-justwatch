import { filterTiles } from "./movieTiles.js";

export const streamingProviders = {};

export const updateStreamingProviderIcons = (streamingProviders) => {
  // Select the container for the streaming provider icons
  const spIconsContainer = document.querySelector("#icons-container");
  spIconsContainer.innerHTML = "";

  // Loop through each streaming provider
  for (let i = 0; i < streamingProviders.length; i++) {
    const provider = streamingProviders[i];

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

    // Add the streaming provider icon to the container
    spIconsContainer.appendChild(spIcon);
  }
};
