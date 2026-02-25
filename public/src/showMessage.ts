import { getToastImpl } from "./toastApi";

export const queuedMessages: unknown[] = [];

export function plainText(str: unknown): string {
  if (typeof str !== "string") return "";
  return str
    .replace(/<br\s*\/?>\s*/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .trim();
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
  const izi = (globalThis as { iziToast?: { show: (o: Record<string, unknown>) => void } }).iziToast;
  if (typeof izi === "undefined") return;
  const visibleToastsCount = document.querySelectorAll(".iziToast-capsule")?.length || 0;
  if (visibleToastsCount >= 3) {
    if (isHTML) queuedMessages.push(messageData);
    return;
  }
  const m = messageData as MessageWithLink;
  const toastOptions: Record<string, unknown> = {
    message: isHTML
      ? `<a href="${m.url}" target="_blank" onclick="searchSubs('${m.title}')">${m.text}</a>`
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
