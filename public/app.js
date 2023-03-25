import { toggleNotice } from "./noticeFunctions.js";
import { showMessage } from "./showMessage.js";
import { showError } from "./showError.js";
import {
  alternativeSearch,
  showAlternativeSearch,
} from "./alternativeSearch.js";
import { rebuildMovieMosaic } from "./movieTiles.js";

window.alternativeSearch = alternativeSearch;

const form = document.getElementById("movie-form");

form.addEventListener("submit", (event) => {
  event.preventDefault(); // Prevent the form from submitting normally

  console.log(event.target);
  const formData = new FormData(event.target);

  const data = Object.fromEntries(formData.entries());
  console.log(data);

  data.country = document.querySelector("#country1").value;

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
  event.preventDefault(); // Prevent the form from submitting normally

  console.log(event.target);
  const formData = new FormData(event.target);

  let data = Object.fromEntries(formData.entries());

  data = { ...data, username: data.username.trim() };
  if (data.username.length === 0) {
    showError("Please enter valid a username");
    return;
  }

  toggleNotice(`Scraping watchlist for ${data?.username}...`);

  fetch("/api/letterboxd-watchlist", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  })
    .then((response) => response.json())
    .then((response) => {
      console.log(response);
      setTimeout(() => {
        toggleNotice();
      }, 1000);
      const { error, watchlist } = response;
      if (error) {
        showError(error);
        return;
      }
      for (let index = 0; index < watchlist.length; index++) {
        const element = watchlist[index];
        let { title, year, link, poster } = element;
        if (poster == "N/A") poster = "/movie_placeholder.svg";
        rebuildMovieMosaic(title, year, { poster, link });

        let data = { title, year };
        data.country = document.querySelector("#country2").value;

        fetch("/api/search-movie", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
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
              rebuildMovieMosaic(title, year, response);
            }
          })
          .catch((error) => console.error(error));
      }
    })
    .catch((error) => console.error(error));
});

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
        hint: false,
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

  $(".country")
    .select2({
      dropdownAutoWidth: true,
      data: countriesData || [],
      templateSelection: (data) => {
        return `${data.flag}`;
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
      console.log(evt.target);
      $(evt.target)
        .data("select2")
        .$dropdown.find(":input.select2-search__field")
        .attr("placeholder", "🔍");
    });
});
