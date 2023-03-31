import { toggleNotice } from "./noticeFunctions.js";
import { showMessage } from "./showMessage.js";
import { showError } from "./showError.js";
import STATE from "./state.js";

export const alternativeSearch = (event) => {
  event.preventDefault(); // Prevent the form from submitting normally
  // Get the title and year from the clicked row
  const parentElement = event.currentTarget.parentNode;
  console.log(parentElement);
  const isTile = parentElement.classList.contains("poster-info");
  let title,
    year = "";
  if (isTile) {
    const tileId = parentElement.parentElement.getAttribute("data-id");
    const tile = STATE.movieTiles[tileId];
    console.log(tile);
    if (!tile) return;
    title = tile.title;
    year = tile.year;
  } else {
    const res = Object.fromEntries(new FormData(event.target.form).entries());
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
};

export const showAlternativeSearch = () => {
  document
    .querySelector(".alternative-search")
    .classList.remove("hide-alternative-search");
};
