import { getToastImpl } from "./toastApi";
import { plainText } from "./showMessage";

const ERROR_DEDUPE_WINDOW_MS = 3000;
let lastErrorMessage: string | null = null;
let lastErrorAt = 0;

export const showError = (error: unknown): void => {
  const message = plainText(typeof error === "string" ? error : String(error));
  const now = Date.now();
  if (message === lastErrorMessage && now - lastErrorAt < ERROR_DEDUPE_WINDOW_MS) return;
  lastErrorMessage = message;
  lastErrorAt = now;
  const impl = getToastImpl();
  if (impl?.error) {
    impl.error(message);
    return;
  }
  if (typeof (globalThis as { iziToast?: unknown }).iziToast === "undefined") return;
  const toastCount = document.querySelectorAll(".iziToast-capsule")?.length || 0;
  if (toastCount >= 2) return;
  (globalThis as { iziToast?: { show: (o: Record<string, unknown>) => void } }).iziToast?.show({
    title: "Error",
    message: message,
    position: "topRight",
    backgroundColor: "#fbc500",
    timeout: 3000,
  });
};

export interface BatchError {
  title?: string;
  year?: number | string;
  message: string;
}

export const showBatchErrors = (errors: BatchError[] | null | undefined): void => {
  if (!errors?.length) return;
  if (errors.length === 1) {
    const { title, year, message } = errors[0];
    showError(`[${title ?? "?"} (${year ?? "?"})] ${message}`);
    return;
  }
  const uniqueMessages = [...new Set(errors.map((e) => e.message).filter(Boolean))];
  let batchMessage: string;
  if (uniqueMessages.length === 0) {
    batchMessage = `${errors.length} titles encountered errors while loading.`;
  } else if (uniqueMessages.length === 1) {
    batchMessage = `${errors.length} titles: ${uniqueMessages[0]}`;
  } else {
    batchMessage =
      `${errors.length} titles encountered errors while loading:\n` +
      uniqueMessages.map((msg) => `- ${msg}`).join("\n");
  }
  showError(batchMessage);
};
