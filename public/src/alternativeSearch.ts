import { toggleNotice } from "./noticeFunctions";
import { showMessage } from "./showMessage";
import { showError } from "./showError";

let isAlternativeSearchInFlight = false;

export function runAlternativeSearch(
  title: string,
  year?: string | number,
  options?: { setAlternativeSearchLoading?: ((loading: boolean) => void) | null },
): void {
  if (!title) return;
  if (isAlternativeSearchInFlight) {
    showMessage("Already working on torrent search...");
    return;
  }
  isAlternativeSearchInFlight = true;
  options?.setAlternativeSearchLoading?.(true);
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
      else
        showMessage({ text: response.text ?? "", url: response.url, title: response.title }, true);
    })
    .catch((err) => console.error(err))
    .finally(() => {
      isAlternativeSearchInFlight = false;
      options?.setAlternativeSearchLoading?.(false);
    });
}

export function searchSubs(query: string): void {
  const url = `https://subdl.com/search?query=${encodeURIComponent(query)}`;
  window.open(url, "_blank");
}
