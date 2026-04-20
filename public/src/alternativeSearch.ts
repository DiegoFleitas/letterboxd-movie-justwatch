import { toggleNotice } from "./noticeFunctions";
import { showMessage } from "./showMessage";
import { showError } from "./showError";
import { NOTICE_HOLD_ALT_SEARCH_MS } from "./animation/timing";
import { captureFrontendException, captureFrontendMessage } from "./sentry";

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
    .then((res) => {
      if (res.status >= 500) {
        captureFrontendMessage("alternative-search upstream error", {
          tags: { source: "api", endpoint: "/api/alternative-search", reason: "http-5xx" },
          extra: { status: res.status, title, year },
        });
      }
      return res.json();
    })
    .then((response: { error?: string; text?: string; url?: string; title?: string }) => {
      setTimeout(() => toggleNotice(null), NOTICE_HOLD_ALT_SEARCH_MS);
      if (response.error) {
        showError(response.error);
      } else
        showMessage({ text: response.text ?? "", url: response.url, title: response.title }, true);
    })
    .catch((err) => {
      captureFrontendException(err, {
        tags: { source: "api", endpoint: "/api/alternative-search" },
        extra: { title, year },
      });
      console.error(err);
    })
    .finally(() => {
      isAlternativeSearchInFlight = false;
      options?.setAlternativeSearchLoading?.(false);
    });
}

export function searchSubs(query: string): void {
  const url = `https://subdl.com/search?query=${encodeURIComponent(query)}`;
  window.open(url, "_blank");
}
