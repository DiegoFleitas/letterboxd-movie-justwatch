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
  showError(
    `${errors.length} titles have no streaming in your country. Try pirate flags 🏴‍☠️ for alternatives.`
  );
};
