const form = document.getElementById("movie-form");

form.addEventListener("submit", (event) => {
  event.preventDefault(); // Prevent the form from submitting normally

  console.log(event.target);
  const formData = new FormData(event.target);

  const data = Object.fromEntries(formData.entries());
  console.log(data);

  // const url = "/api/helloworld";
  const url = "/api/search-movie";

  // Perform the fetch request
  fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  })
    .then((response) => response.json())
    .then((data) => {
      console.log(data);
      const errorMessage = document.getElementById("error-message");
      const resultMessage = document.getElementById("result-message");
      if (data.error) {
        errorMessage.innerHTML = data.error;
        resultMessage.innerHTML = "";
      } else {
        errorMessage.innerHTML = "";
        resultMessage.innerHTML = data.message;
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
          body: JSON.stringify(element),
        })
          .then((response) => response.json())
          .then((data) => {
            console.log(data);
            const errorMessage = document.getElementById("error-message");
            const resultMessage = document.getElementById("result-message");
            if (data.error) {
              errorMessage.innerHTML += data.error;
              resultMessage.innerHTML = "";
            } else {
              resultMessage.innerHTML += JSON.stringify(element) + data.message;
              rebuildTable(element.title, element.year, data);
            }
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
          .then((response) => response.json())
          .then((data) => {
            console.log(data);
            const errorMessage = document.getElementById("error-message");
            const resultMessage = document.getElementById("result-message");
            if (data.error) {
              errorMessage.innerHTML += data.error;
              resultMessage.innerHTML = "";
            } else {
              resultMessage.innerHTML += JSON.stringify(element) + data.message;
              rebuildTable(element.title, element.year, data);
            }
          })
          .catch((error) => console.error(error));
      }
    })
    .catch((error) => console.error(error));
});

function rebuildTable(title, year, data) {
  const id = `${title.toLowerCase().replace(/ /g, "-")}-${year}`;
  const row =
    document.querySelector(`tr[data-id="${id}"]`) ||
    document.createElement("tr");
  row.setAttribute("data-id", id);

  let [tdTitle, tdYear, tdImg, tdStreaming] = [...row.children];
  if (!tdTitle) tdTitle = document.createElement("td");
  if (!tdYear) tdYear = document.createElement("td");
  if (!tdImg) tdImg = document.createElement("td");
  if (!tdStreaming) tdStreaming = document.createElement("td");

  tdTitle.textContent = title;
  tdYear.textContent = year;
  if (data.poster)
    tdImg.innerHTML = `<img class="poster" src="${data.poster}" />`;

  tdStreaming.textContent = data.streamingServices
    ? data.streamingServices.join(", ")
    : "";

  if (!row.parentNode) document.querySelector("tbody").appendChild(row);
  if (!row.parentNode && !tdStreaming.textContent) return;
  row.innerHTML = "";
  [tdTitle, tdYear, tdImg, tdStreaming].forEach((td) => row.appendChild(td));

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
