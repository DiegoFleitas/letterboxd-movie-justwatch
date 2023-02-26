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
      if (response.status === 404) {
        showWinkElements();
      }
      return response.json();
    })
    .then((response) => {
      console.log(response);
      const errorMessage = document.getElementById("error-message");
      const resultMessage = document.getElementById("result-message");
      if (response.error) {
        errorMessage.innerHTML = response.error;
        errorMessage.style.display = "";
        resultMessage.style.display = "none";
      } else {
        resultMessage.innerHTML = `${
          response.message
        }: ${response.streamingServices.join(", ")}`;
        resultMessage.style.display = "";
        errorMessage.style.display = "none";
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
            const errorMessage = document.getElementById("error-message");
            const resultMessage = document.getElementById("result-message");
            if (response.error) {
              errorMessage.innerHTML = response.error;
              errorMessage.style.display = "";
              resultMessage.style.display = "none";
            } else {
              resultMessage.innerHTML = `${response.message}`;
              resultMessage.style.display = "";
              errorMessage.style.display = "none";
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
            if (response.status === 404) {
              showWinkElements();
            }
            return response.json();
          })
          .then((response) => {
            console.log(response);
            const errorMessage = document.getElementById("error-message");
            const resultMessage = document.getElementById("result-message");
            if (response.error) {
              errorMessage.innerHTML = response.error;
              errorMessage.style.display = "";
              resultMessage.style.display = "none";
            } else {
              resultMessage.innerHTML = `${response.message}`;
              resultMessage.style.display = "";
              errorMessage.style.display = "none";
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

  // Make a fetch request to the /wink endpoint
  fetch("/api/wink", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title, year }),
  })
    .then((response) => response.json())
    .then((response) => {
      console.log(response);
      const errorMessage = document.getElementById("error-message");
      const resultMessage = document.getElementById("result-message");
      if (response.error) {
        errorMessage.innerHTML = response.error;
        errorMessage.style.display = "";
        resultMessage.style.display = "none";
      } else {
        resultMessage.innerHTML = "😉";
        const link = document.createElement("a");
        link.setAttribute("href", response.url);
        link.setAttribute("target", "_blank");
        link.innerHTML = response.text;
        resultMessage.appendChild(link);
        resultMessage.style.display = "";
        errorMessage.style.display = "none";
        scrollToTop();
      }
    })
    .catch((error) => {
      console.log("Error:", error);
    });
}

function rebuildTable(title, year, data) {
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

  tdStreaming.textContent = data.streamingServices
    ? data.streamingServices.join(", ")
    : "";

  tdWink.innerHTML = `<button onclick="alternativeSearchWink(event)" class="wink">😉</button>`;

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
        .map((text) => text.split(", "))
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
          td.parentElement.style.display = "table-row";
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
  const winkElements = document.querySelectorAll(".wink");
  winkElements.forEach((element) => (element.style.display = "block"));
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
      url: "https://www.omdbapi.com/?s=%QUERY&apikey=dacba5fa",
      wildcard: "%QUERY",
      transform: (response) => {
        return response.Search || [];
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
            return "<div>" + movie.Title + " (" + movie.Year + ")</div>";
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
