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
      if (response.status === 502) {
        console.error(response);
      }
      if (response.status === 404) {
        showWinkElements();
      }
      return response.json();
    })
    .then((response) => {
      console.log(response);
      if (response.error) {
        showError(response.error);
      } else {
        const msg = `${response.message}: ${response.streamingServices.join(
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
              showMessage(response.message);
            }
            response.link = element.link;
            if (!response.poster || response.poster == "N/A")
              response.poster = "/movie_placeholder.svg";
            rebuildTable(element.title, element.year, response);
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
            if (response.status === 404) {
              showWinkElements();
            }
            return response.json();
          })
          .then((response) => {
            console.log(response);
            if (response.error) {
              showError(response.error);
            } else {
              const msg = `${
                response.message
              }: ${response.streamingServices.join(", ")}`;
              showMessage(msg);
              rebuildTable(element.title, element.year, response);
            }
          })
          .catch((error) => console.error(error));
      }
    })
    .catch((error) => console.error(error));
});

function alternativeSearchWink(event) {
  event.preventDefault(); // Prevent the form from submitting normally
  // Get the title and year from the clicked row
  const parentElement = event.currentTarget.parentNode.parentNode;
  const isRow = parentElement.nodeName === "TR";
  let title, year;
  if (isRow) {
    title = parentElement.cells[0].textContent;
    year = parentElement.cells[1].textContent;
  } else {
    res = Object.fromEntries(new FormData(event.target.form).entries());
    title = res.title;
    year = res.year;
  }

  if (!title) return;

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
      if (response.error) {
        showError(response.error);
      } else {
        showMessage(response, true);
        scrollToTop();
      }
    })
    .catch((error) => {
      console.log("Error:", error);
    });
}

function showError(error) {
  console.log(error);
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

function showMessage(data, isHTML = false) {
  console.log(data, isHTML);
  if (isHTML) {
    iziToast.show({
      message: `
        <a href="${data.url}" target="_blank">
          ${data.text}
        </a>
        `,
      theme: "light",
      layout: 1,
      progressBar: false,
      timeout: false,
      position: "topRight",
      backgroundColor: "#fbc500",
    });
  } else {
    iziToast.show({
      message: data,
      theme: "light",
      layout: 1,
      progressBar: false,
      timeout: 3000,
      position: "topRight",
      backgroundColor: "#fbc500",
    });
  }
}

function rebuildTable(title, year, data) {
  console.log(arguments);
  const id = `${title.toLowerCase().replace(/ /g, "-")}-${year}`;
  const row =
    document.querySelector(`tr[data-id="${id}"]`) ||
    document.createElement("tr");
  row.setAttribute("data-id", id);

  let [tdTitle, tdYear, tdImg, tdStreaming, tdWink] = [...row.children];
  if (!tdTitle) tdTitle = document.createElement("td");
  if (!tdYear) tdYear = document.createElement("td");
  if (!tdImg) tdImg = document.createElement("td");
  if (!tdStreaming) tdStreaming = document.createElement("td");
  if (!tdWink) tdWink = document.createElement("td");

  tdTitle.textContent = title;
  tdYear.textContent = year;
  if (data.poster)
    tdImg.innerHTML = `<a href="${data.link}" target="_blank">
    <img class="poster" src="${data.poster}" />
    </a>`;

  if (data.streamingServices)
    tdStreaming.textContent =
      data.streamingServices ?? data.streamingServices.join(", ");

  tdWink.innerHTML = `<button onclick="alternativeSearchWink(event)" class="alternative-search hide-alternative-search">😉</button>`;

  if (!row.parentNode) document.querySelector("tbody").appendChild(row);
  if (!row.parentNode && !tdStreaming.textContent) return;
  row.innerHTML = "";
  [tdTitle, tdYear, tdImg, tdStreaming, tdWink].forEach((td) =>
    row.appendChild(td)
  );

  if (data.streamingServices) {
    rebuildTableFilter();
  }
}

function rebuildTableFilter() {
  const table = document.querySelector("table");
  let select = document.querySelector("#service-picker");

  // Create an array of all the unique streaming services in the table
  const services = Array.from(
    new Set(
      Array.from(table.querySelectorAll("td:nth-of-type(4)"))
        .map((td) => td.textContent.trim())
        .map((text) => text.split(","))
        .flat()
    )
  );

  // Add the select element to the page if it doesn't already exist
  if (!select) {
    select = document.createElement("select");
    select.setAttribute("id", "service-picker");
    const header = table.querySelector("thead");
    header.insertBefore(select, header.firstChild);

    // Add an event listener to the select element to filter the table when an option is selected
    select.addEventListener("change", () => {
      const selectedService = select.value;
      Array.from(table.querySelectorAll("td:nth-of-type(4)")).forEach((td) => {
        const streamingServices = td.textContent;
        if (streamingServices.includes(selectedService)) {
          td.parentElement.style.display = "";
        } else {
          td.parentElement.style.display = "none";
        }
      });
    });
  } else {
    // Clear any existing options from the select element
    select.innerHTML = "";
  }

  // Populate the select element with options for each streaming service
  services.forEach((service) => {
    const option = document.createElement("option");
    option.textContent = service;
    select.appendChild(option);
  });
}

function showWinkElements() {
  const winkElements = document.querySelectorAll(".hide-alternative-search");
  winkElements.forEach((element) =>
    element.classList.toggle("hide-alternative-search")
  );
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
    });
});

function scrollToTop() {
  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
}
