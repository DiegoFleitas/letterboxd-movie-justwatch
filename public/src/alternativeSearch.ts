import { toggleNotice } from "./noticeFunctions";
import { showMessage } from "./showMessage";
import { showError } from "./showError";

export function runAlternativeSearch(title: string, year?: string | number): void {
  if (!title) return;
  toggleNotice(`Searching for ${title} (${year})...`);
  fetch("/api/alternative-search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, year }),
  })
    .then((res) => res.json())
    .then((response: { error?: string; text?: string; url?: string; title?: string }) => {
      setTimeout(() => toggleNotice(null), 1000);
      if (response.error) showError(response.error);
      else showMessage({ text: response.text ?? "", url: response.url, title: response.title }, true);
    })
    .catch((err) => console.error(err));
}

export function searchSubs(query: string): void {
  const url = `https://subdl.com/search?query=${encodeURIComponent(query)}`;
  window.open(url, "_blank");
}
