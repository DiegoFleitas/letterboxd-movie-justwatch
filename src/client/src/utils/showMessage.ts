import { getToastImpl } from "./toastApi";
import { escapeHtml, sanitizeHrefForToast } from "./htmlSafeForToast";

const queuedMessages: unknown[] = [];

const HTML_BR_PATTERN = /<br\s*\/?>\s*/gi;
const HTML_TAG_PATTERN = /<[^>]*>/g;

export function plainText(str: unknown): string {
  if (typeof str !== "string") return "";
  let text = str.replace(HTML_BR_PATTERN, "\n");
  // Strip tags repeatedly until the string stops changing. A single pass can
  // leave a new tag behind for nested input such as `<scr<script>ipt>`, which
  // is the incomplete multi-character sanitization CodeQL reports here.
  let previous: string;
  do {
    previous = text;
    text = text.replace(HTML_TAG_PATTERN, "");
  } while (text !== previous);
  return text.trim();
}

interface MessageWithLink {
  text: string;
  url?: string;
  title?: string;
}

export function showMessage(messageData: string | MessageWithLink, isHTML = false): void {
  const impl = getToastImpl();
  if (impl?.success) {
    if (isHTML && impl.messageWithLink) {
      impl.messageWithLink(messageData as MessageWithLink);
    } else {
      const msg =
        typeof messageData === "string"
          ? plainText(messageData)
          : plainText((messageData as MessageWithLink)?.text ?? "");
      impl.success(msg);
    }
    return;
  }
  const izi = (globalThis as { iziToast?: { show: (o: Record<string, unknown>) => void } })
    .iziToast;
  if (typeof izi === "undefined") return;
  const visibleToastsCount = document.querySelectorAll(".iziToast-capsule")?.length || 0;
  if (visibleToastsCount >= 3) {
    if (isHTML) queuedMessages.push(messageData);
    return;
  }
  const m = messageData as MessageWithLink;
  const toastOptions: Record<string, unknown> = {
    message: isHTML
      ? `<a href="${sanitizeHrefForToast(m.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(m.text)}</a>`
      : messageData,
    theme: "light",
    layout: 1,
    progressBar: false,
    timeout: isHTML ? false : 3000,
    position: "topRight",
    backgroundColor: "#40bcf4",
  };
  if (isHTML) {
    toastOptions.onClosed = () => {
      if (queuedMessages.length > 0) showMessage(queuedMessages.shift() as MessageWithLink, true);
    };
  }
  izi.show(toastOptions);
}
