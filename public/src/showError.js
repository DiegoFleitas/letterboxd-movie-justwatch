export const showError = (error) => {
  console.log(error);
  // Check visible toast count before showing another toast
  const toastCount =
    document.querySelectorAll(".iziToast-capsule")?.length || 0;
  if (toastCount >= 3) {
    console.log(
      `There are already ${toastCount} visible toasts on the page, error skipped. Message: ${error}`
    );
    return;
  }
  iziToast.show({
    title: "Error",
    message: error,
    color: "red",
    position: "topCenter",
    progressBarColor: "red",
    progressBarEasing: "linear",
    progressBar: true,
    timeout: 3000,
    resetOnHover: true,
    overlay: false,
    overlayClose: true,
    position: "topRight",
    backgroundColor: "#fbc500",
  });
};
