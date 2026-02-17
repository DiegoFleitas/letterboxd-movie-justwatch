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
