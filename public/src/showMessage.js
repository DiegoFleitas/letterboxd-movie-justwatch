import { getToastImpl } from "./toastApi.js";

export const queuedMessages = [];

/** Turn HTML-ish strings into plain text for toast display (no parsing). */
export function plainText(str) {
  if (typeof str !== "string") return "";
  return str
    .replace(/<br\s*\/?>\s*/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .trim();
}

export const showMessage = (messageData, isHTML = false) => {
  const impl = getToastImpl();
  if (impl?.success) {
    if (isHTML && impl.messageWithLink) {
      impl.messageWithLink(messageData);
    } else {
      const msg =
        typeof messageData === "string"
          ? plainText(messageData)
          : plainText(messageData?.text ?? "");
      impl.success(msg);
    }
    return;
  }
  if (typeof iziToast === "undefined") return;
  const visibleToastsCount = document.querySelectorAll(".iziToast-capsule")?.length || 0;
  if (visibleToastsCount >= 3) {
    if (isHTML) queuedMessages.push(messageData);
    return;
  }
  const toastOptions = {
    message: isHTML
      ? `<a href="${messageData.url}" target="_blank" onclick="searchSubs('${messageData.title}')">${messageData.text}</a>`
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
      if (queuedMessages.length > 0) showMessage(queuedMessages.shift(), true);
    };
  }
  iziToast.show(toastOptions);
};
