import { toggleNotice } from "./noticeFunctions.js";
import { showMessage } from "./showMessage.js";
import { showError } from "./showError.js";

export function runAlternativeSearch(title, year) {
  if (!title) return;
  toggleNotice(`Searching for ${title} (${year})...`);
  fetch("/api/alternative-search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, year }),
  })
    .then((res) => res.json())
    .then((response) => {
      setTimeout(toggleNotice, 1000);
      if (response.error) showError(response.error);
      else showMessage(response, true);
    })
    .catch((err) => console.error(err));
}

export const searchSubs = (query) => {
  // const url = `https://duckduckgo.com/?q=!ducky+subdl+${query}`
  const url = `https://subdl.com/search?query=${query}`;
  window.open(url, "_blank");
};
