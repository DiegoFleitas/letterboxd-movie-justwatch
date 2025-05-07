import { toggleNotice } from "./noticeFunctions.js";
import { showMessage } from "./showMessage.js";
import { showError } from "./showError.js";
import {
  alternativeSearch,
  showAlternativeSearch,
  searchSubs,
} from "./alternativeSearch.js";
import { rebuildMovieMosaic } from "./movieTiles.js";
import { countries, generes } from "./consts.js";

// for onclick events
window.alternativeSearch = alternativeSearch;
window.searchSubs = searchSubs;
window.hideSpinner = (img) => {
  // get the parent div of the loaded image
  const parent = img.parentNode;
  // get the spinner inside the parent div
  const spinner = parent.querySelector(".spinner");
  // hide the spinner
  spinner.style.display = "none";
};

const form = document.getElementById("movie-form");

form.addEventListener("submit", (event) => {
  event.preventDefault(); // Prevent the form from submitting normally
  const formData = new FormData(event.target);
  const data = Object.fromEntries(formData.entries());
  data.country = document.querySelector("#country1").value;

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
      const { error, title, year, message, movieProviders } = response;
      if (error) {
        showMessage(`[${title} (${year})] ${error}`);
      } else {
        const streamingProviders = movieProviders
          .map((entry) => entry.name)
          .join(", ");
        const msg = `[${title} (${year})] ${message}: ${streamingProviders}`;
        showMessage(msg);
      }
    })
    .catch((error) => console.error(error));
});

const letterboxForm = document.getElementById("letterboxd-form");

letterboxForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(event.target);
  let data = Object.fromEntries(formData.entries());
  let { listUrl } = data;

  if (!listUrl) {
    showError("Please enter a valid URL");
    return;
  }

  listUrl = listUrl.split('/page')[0];
  if (!listUrl.includes('watchlist') && !listUrl.includes('list')) {
    listUrl += '/watchlist';
  }
  if (!listUrl.endsWith('/')) {
    listUrl += '/';
  }

  const urlPattern = /https:\/\/letterboxd\.com\/([^\/]+)\/(watchlist|list\/[^\/]+)\//;
  const match = listUrl.match(urlPattern);

  if (!match) {
    showError("Invalid URL format");
    return;
  }

  const username = match[1];
  const listType = match[2].startsWith("list/") ? "custom list" : "watchlist";

  data = { ...data, username, listType, listUrl: listUrl.trim(), page: 1 };

  toggleNotice(`Scraping ${listType} for ${username}...`);

  if (listType !== "watchlist") {
    await loadCustomList(data);
  } else {
    await loadWatchlist(data);
  }
});

const processList = async (data, responseData, url) => {
  try {
    const { error, watchlist, lastPage, totalPages } = responseData;
    allPagesLoaded = lastPage === totalPages;
    watchlistPageCount = totalPages;

    if (error) {
      showError(error);
      return;
    }

    for (const element of watchlist) {
      let { title, year, link, poster } = element;
      if (poster == "N/A") poster = "/movie_placeholder.svg";
      rebuildMovieMosaic(title, year, { poster, link });

      let movieData = { title, year };
      movieData.country = document.querySelector("#country2").value;

      fetch("/api/search-movie", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(movieData),
      })
        .then((response) => {
          if (response.status === 502) {
            console.error(response);
          }
          return response.json();
        })
        .then((response) => {
          const { error, title, year } = response;
          if (error) {
            showError(`[${title} (${year})] ${error}`);
          } else {
            rebuildMovieMosaic(title, year, response);
          }
        })
        .catch((error) => console.error(error));
    }

    // Update the page number
    data.page = lastPage;

    if (!allPagesLoaded) {
      showMessage(`Loaded page ${data.page} of ${totalPages}...`);

      if (!scrollListenerAdded) {
        scrollListenerAdded = true;
        window.addEventListener("scroll", handleScroll.bind(null, data), {
          passive: true,
        });
      }
    } else {
      if (totalPages)
        showMessage(`Loaded all ${totalPages} pages!`);
      else
        showMessage(`Loaded all pages!`);
    }
  } catch (error) {
    console.error(error);
  } finally {
    setTimeout(() => {
      toggleNotice();
    }, 1000);
  }
};

const loadWatchlist = async (data) => {
  const response = await fetch("/api/letterboxd-watchlist", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  const responseData = await response.json();
  await processList(data, responseData, "/api/letterboxd-watchlist");
};

const loadCustomList = async (data) => {
  const response = await fetch("/api/letterboxd-custom-list", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  const responseData = await response.json();
  await processList(data, responseData, "/api/letterboxd-custom-list");
};

let allPagesLoaded = false; // prevent unnecessary fetch requests
let scrollListenerAdded = false; // prevent multiple scroll listeners
let watchlistPageCount = 0;
const MAX_PAGES_PER_LOAD = 20;
let isLoading = false; // prevent simultaneous requests

function handleScroll(data) {
  if (allPagesLoaded) {
    window.removeEventListener("scroll", handleScroll);
    return;
  }

  // Check if the user has scrolled close to the bottom
  const scrollThreshold = 100;
  if (
    !isLoading &&
    window.innerHeight + window.scrollY + scrollThreshold >=
    document.documentElement.scrollHeight
  ) {
    isLoading = true;

    let pagesLodingCount = Math.min(
      watchlistPageCount - data.page,
      MAX_PAGES_PER_LOAD
    );
    showMessage(`Loading another ${pagesLodingCount} page chunk...`);

    loadWatchlist(data).finally(() => {
      isLoading = false;
    });
  }
}

// convert genre_ids to genre names as well as truncate too many genres
const getGenreNames = (genre_ids) => {
  const MAX_GENRES = 3;
  const genreNames = genre_ids
    .map((id) => generes?.find((genre) => genre.id === id)?.name || "")
    .filter((name) => name); // This will remove any falsy values (like "") from the array

  const truncatedGenreNames = genreNames.slice(0, MAX_GENRES);
  const additionalGenresCount = genreNames.length - MAX_GENRES;

  return (
    truncatedGenreNames.join(", ") + (additionalGenresCount > 0 ? ", ..." : "")
  );
};

/** Automagically search movies */
$(document).ready(() => {
  // Debounce to delay the execution
  const debounce = (func, wait) => {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  };

  // Bloodhound configuration
  const movies = new Bloodhound({
    datumTokenizer: Bloodhound.tokenizers.whitespace,
    queryTokenizer: Bloodhound.tokenizers.whitespace,
    identify: (obj) => obj.imdbID,
    remote: {
      url: "api/proxy/https://api.themoviedb.org/3/search/movie?query=%QUERY",
      wildcard: "%QUERY",
      transform: (response) => {
        const movieResults = response.results || [];
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
        hint: false,
        highlight: true,
        minLength: 3,
      },
      {
        name: "movies",
        display: (movie) => movie.title,
        source: (query, syncResults, asyncResults) => {
          debounce(() => {
            movies.search(query, syncResults, asyncResults);
          }, 200)();
        },
        templates: {
          suggestion: (movie) => {
            const poster = movie.poster_path
              ? `<img src="https://image.tmdb.org/t/p/w92${movie.poster_path}" class="mr-3" alt="${movie.title}" width="50">`
              : "";
            const genreString = getGenreNames(movie.genre_ids);
            const releaseString = movie.release_date
              ? `(${movie.release_date.slice(0, 4)})`
              : "";
            return `
                  <li class="list-group-item d-flex align-items-center">
                    ${poster}
                    <div><strong>${movie.title}</strong> ${releaseString} </div>
                    <small><i>${genreString}</i></small>
                  </li>
                `;
          },
        },
      }
    )
    .on("typeahead:selected", (event, suggestion, dataset) => {
      const year = suggestion.release_date.slice(0, 4);
      $("#year").val(year);
      $("#title").val(suggestion.title);
    })
    .on("change", (event) => {
      $("#title").val(event.target.value);
    });

  $(".country")
    .select2({
      dropdownAutoWidth: true,
      data: countries || [],
      templateSelection: (data) => {
        return `${data.flag} ${data.id.split("_")[1]}`;
      },
      templateResult: (data) => {
        return `${data.flag}`;
      },
      matcher: (params, data) => {
        if ($.trim(params.term) === "") {
          return data;
        }
        if (data.text.toLowerCase().indexOf(params.term.toLowerCase()) > -1) {
          return data;
        }
        return null;
      },
    })
    .on("change", (evt) => {
      // sync the two select2 dropdowns
      const selectedValue = $(evt.target).val();
      const id = $(evt.target).attr("id");
      if (id === "country1" && $("#country2").val() !== selectedValue) {
        $("#country2").val(selectedValue).trigger("change");
      } else if (id === "country2" && $("#country1").val() !== selectedValue) {
        $("#country1").val(selectedValue).trigger("change");
      }
    })
    .on("select2:open", (evt) => {
      // set the placeholder text
      $(evt.target)
        .data("select2")
        .$dropdown.find(":input.select2-search__field")
        .attr("placeholder", "🔍");
    });
});

// Random text
const messages = [
  "Star me on GitHub!",
  "Try uBlock Origin!",
  "Use magnet links!",
  "Click pirate flags!",
  "Watch 'The Thing'!",
  "Watch 'Kill Bill: Vol. 1'!",
  "Watch 'Raiders of the Lost Ark'!",
  "Watch 'Cinema Paradiso'!",
  "Watch 'Gremlins'!",
  "Watch 'Rocky'!",
  "Watch 'Ferris Bueller’s Day Off'!",
  "Also try Terraria!",
  "Also try Minecraft!",
  "Try Radarr & letterboxd-list-radarr!",
  "Try Sonarr & mal-list-sonarr!",
  "Try Plex!",
];

const getRandomMessage = () => {
  const randomIndex = Math.floor(Math.random() * messages.length);
  return messages[randomIndex];
};

const changeText = () => {
  const textDiv = document.getElementById("minecraft-text");
  textDiv.innerHTML = getRandomMessage();
};

window.onload = changeText;