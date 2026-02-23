import { getToastImpl } from "./toastApi.js";
import { plainText } from "./showMessage.js";

export const showError = (error) => {
  const impl = getToastImpl();
  if (impl?.error) {
    impl.error(plainText(typeof error === "string" ? error : String(error)));
    return;
  }
  if (typeof iziToast === "undefined") return;
  const toastCount = document.querySelectorAll(".iziToast-capsule")?.length || 0;
  if (toastCount >= 2) return;
  iziToast.show({
    title: "Error",
    message: error,
    position: "topRight",
    backgroundColor: "#fbc500",
    timeout: 3000,
  });
};

/**
 * Show one toast for a batch of list-load errors instead of one per movie.
 * @param {Array<{ title: string, year: number|string, message: string }>} errors
 */
export const showBatchErrors = (errors) => {
  if (!errors?.length) return;
  if (errors.length === 1) {
    const { title, year, message } = errors[0];
    showError(`[${title} (${year})] ${message}`);
    return;
  }
  const uniqueMessages = [
    ...new Set(errors.map((error) => error.message).filter(Boolean)),
  ];
  let batchMessage;

  if (uniqueMessages.length === 0) {
    batchMessage = `${errors.length} titles encountered errors while loading.`;
  } else if (uniqueMessages.length === 1) {
    // All errors share the same cause; summarize using that shared message.
    batchMessage = `${errors.length} titles: ${uniqueMessages[0]}`;
  } else {
    // Multiple distinct causes; provide a generic summary plus the unique messages.
    batchMessage =
      `${errors.length} titles encountered errors while loading:\n` +
      uniqueMessages.map((msg) => `- ${msg}`).join("\n");
  }

  showError(batchMessage);
};
