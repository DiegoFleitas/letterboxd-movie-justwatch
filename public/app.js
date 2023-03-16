const form = document.getElementById("movie-form");

form.addEventListener("submit", (event) => {
  event.preventDefault(); // Prevent the form from submitting normally

  console.log(event.target);
  const formData = new FormData(event.target);

  const data = Object.fromEntries(formData.entries());
  console.log(data);

  // Perform the fetch request
  fetch("/api/search-movie", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  })
    .then((response) => {
      showAlternativeSearch();
      if (response.status === 502) {
        console.error(response);
      }
      return response.json();
    })
    .then((response) => {
      console.log(response);
      const { error, title, year, message, streamingServices } = response;
      if (error) {
        showError(`[${title} (${year})] ${error}`);
      } else {
        const msg = `[${title} (${year})] ${message}: ${streamingServices.join(
          ", "
        )}`;
        showMessage(msg);
      }
    })
    .catch((error) => console.error(error));
});

const letterboxdWatchlistForm = document.getElementById(
  "letterboxd-watchlist-form"
);

letterboxdWatchlistForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const formData = new FormData(letterboxdWatchlistForm);

  fetch("/api/letterboxd-watchlist", {
    method: "POST",
    body: formData,
  })
    .then((response) => response.json())
    .then((data) => {
      console.log(data);
      const transformedData = data.map((item) => ({
        title: item.Name,
        year: item.Year,
        link: item["Letterboxd URI"],
      }));
      console.log(transformedData);
      for (let index = 0; index < transformedData.length; index++) {
        // for (let index = 0; index < 5; index++) {
        const element = transformedData[index];
        console.log("poster");
        fetch("/api/poster", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ title: element.title, year: element.year }),
        })
          .then((response) => response.json())
          .then((response) => {
            console.log(response);
            if (response.error) {
              showError(response.error);
            } else {
              // showMessage(response.message);
            }
            response.link = element.link;
            if (!response.poster || response.poster == "N/A")
              response.poster = "/movie_placeholder.svg";
            rebuildMovieMosaic(element.title, element.year, response);
          })
          .catch((error) => console.error(error));
        // Perform the fetch request
        fetch("/api/search-movie", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(element),
        })
          .then((response) => {
            if (response.status === 502) {
              console.error(response);
            }
            return response.json();
          })
          .then((response) => {
            console.log(response);
            const { error, title, year, message, streamingServices } = response;
            if (error) {
              showError(`[${title} (${year})] ${error}`);
            } else {
              const msg = `[${title} (${year})] ${message}: ${streamingServices.join(
                ", "
              )}`;
              showMessage(msg);
              rebuildMovieMosaic(element.title, element.year, response);
            }
          })
          .catch((error) => console.error(error));
      }
    })
    .catch((error) => console.error(error));
});

function alternativeSearch(event) {
  event.preventDefault(); // Prevent the form from submitting normally
  // Get the title and year from the clicked row
  const parentElement = event.currentTarget.parentNode;
  console.log(parentElement);
  const isTile = parentElement.classList.contains("poster-info");
  let title,
    year = "";
  if (isTile) {
    const tileId = parentElement.parentElement.getAttribute("data-id");
    const tile = movieTiles[tileId];
    console.log(tile);
    if (!tile) return;
    title = tile.title;
    year = tile.year;
  } else {
    res = Object.fromEntries(new FormData(event.target.form).entries());
    title = res.title;
    year = res.year;
  }

  if (!title) return;

  toggleNotice(`Searching for ${title} (${year})...`);

  // Make a fetch request to the /alternative-search endpoint
  fetch("/api/alternative-search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title, year }),
  })
    .then((response) => response.json())
    .then((response) => {
      console.log(response);
      setTimeout(() => {
        toggleNotice();
      }, 1000);
      if (response.error) {
        showError(response.error);
      } else {
        showMessage(response, true);
      }
    })
    .catch((error) => {
      console.log("Error:", error);
    });
}

function showError(error) {
  console.log(error);
  // Check visible toast count before showing another toast
  toastCount = document.querySelectorAll(".iziToast-capsule")?.length || 0;
  if (toastCount >= 7) {
    console.log(
      `There are already ${toastCount} visible toasts on the page, error skipped. Message: ${error}`
    );
    return;
  }
  iziToast.show({
    title: "Error",
    message: error,
    color: "red",
    position: "topCenter",
    progressBarColor: "red",
    progressBarEasing: "linear",
    progressBar: true,
    timeout: 3000,
    resetOnHover: true,
    overlay: true,
    overlayClose: true,
    position: "topRight",
    backgroundColor: "#fbc500",
  });
}

const queuedMessages = [];

function showMessage(messageData, isHTML = false) {
  console.log(messageData, isHTML);

  const visibleToastsCount =
    document.querySelectorAll(".iziToast-capsule")?.length || 0;

  // don't show more than 3 toasts at a time
  if (visibleToastsCount >= 3) {
    // if the message is HTML, queue it up to show after the current toasts are closed
    if (isHTML) queuedMessages.push(messageData);
    console.log(
      `There are already ${visibleToastsCount} visible toasts on the page, message queued. Message: ${messageData}`
    );
    return;
  }

  const toastOptions = {
    message: isHTML
      ? `<a href="${messageData.url}" target="_blank">${messageData.text}</a>`
      : messageData,
    theme: "light",
    layout: 1,
    progressBar: false,
    timeout: isHTML ? false : 3000,
    position: "topRight",
    backgroundColor: "#fbc500",
  };

  if (isHTML) {
    toastOptions.onClosed = () => {
      if (queuedMessages.length > 0) {
        showMessage(queuedMessages.shift(), true);
      }
    };
  }

  iziToast.show(toastOptions);
}

function toggleNotice(msg) {
  const notice = document.querySelectorAll("#notice")?.[0];
  if (notice) {
    // remove iziToast-capsule to avoid stacking
    notice.parentElement.remove();
    return;
  }

  try {
    iziToast.show({
      id: "notice",
      title: "Please wait...",
      message: msg,
      theme: "dark",
      progressBarColor: "#5DA5DA",
      progressBarEasing: "linear",
      timeout: 10000, // 10s
    });
  } catch (error) {
    // normal to get an error here, but it's ok
  }
}

function hideNotice() {
  const notice = document.querySelector(".iziToast-capsule")?.[0];
  if (notice) notice.remove();
}

const movieTiles = {};
const updatedTiles = {};
let streamingProviders = {};

function rebuildMovieMosaic(title, year, data) {
  const id = `${year}-${title
    .toUpperCase()
    .replace(/ /g, "-")
    .replace(/[^A-Z0-9]/g, "")}`;

  const existingTile = document.querySelector(`div[data-id="${id}"]`);

  if (existingTile) {
    const tileData = movieTiles[id];
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

    movieTiles[id] = tileData; // Store the tile data
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
}

function updateTile(tile, data) {
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
}

function showAlternativeSearch() {
  document
    .querySelector(".alternative-search")
    .classList.remove("hide-alternative-search");
}

function filterTiles() {
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

  Object.values(movieTiles).forEach((data) => {
    const streamingServices = data.streamingServices;
    const includedServices = selectedServices.filter((service) =>
      streamingServices.includes(service)
    );
    const tile = document.querySelector(`div[data-id="${data.id}"]`);
    if (includedServices.length > 0) {
      tile.style.display = "";
    } else {
      tile.style.display = "none";
    }
  });
}

function updateStreamingProviderIcons(streamingProviders) {
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
}

/** Automagically search movies */
$(document).ready(() => {
  const movies = new Bloodhound({
    datumTokenizer: Bloodhound.tokenizers.whitespace,
    queryTokenizer: Bloodhound.tokenizers.whitespace,
    identify: (obj) => {
      return obj.imdbID;
    },
    remote: {
      url: "proxy/https://www.omdbapi.com/?s=%QUERY",
      wildcard: "%QUERY",
      transform: (response) => {
        const movieResults =
          response.Search?.filter((result) => result.Type === "movie") || [];
        return movieResults;
      },
      ajax: {
        beforeSend: (xhr) => {
          xhr.overrideMimeType("text/plain; charset=x-user-defined");
        },
      },
    },
  });

  $("#movie-input")
    .typeahead(
      {
        hint: true,
        highlight: true,
        minLength: 3,
      },
      {
        name: "movies",
        display: "Title",
        source: movies,
        templates: {
          suggestion: (movie) => {
            console.log(movie);
            const poster =
              movie.Poster && movie.Poster !== "N/A"
                ? `<img src="${movie.Poster}" class="mr-3" alt="${movie.Title}" width="50">`
                : "";
            return `
              <li class="list-group-item d-flex align-items-center">
                ${poster}
                <div><strong>${movie.Title}</strong> (${movie.Year}) </div>
              </li>
            `;
          },
        },
      }
    )
    .on("typeahead:selected", (event, suggestion, dataset) => {
      const year = suggestion.Year.match(/\d+/);
      $("#year").val(year);
      $("#title").val(suggestion.Title);
    })
    .on("change", (event) => {
      $("#title").val(event.target.value);
    });
});
