export const queuedMessages = [];

export const showMessage = (messageData, isHTML = false) => {
  console.log(messageData, isHTML);

  const visibleToastsCount =
    document.querySelectorAll(".iziToast-capsule")?.length || 0;

  // don't show more than 3 toasts at a time
  if (visibleToastsCount >= 3) {
    // if the message is HTML, queue it up to show after the current toasts are closed
    if (isHTML) queuedMessages.push(messageData);
    console.log(
      `There are already ${visibleToastsCount} visible toasts on the page, message queued. Message: ${messageData}`
    );
    return;
  }

  const toastOptions = {
    message: isHTML
      ? `<a href="${messageData.url}" target="_blank">${messageData.text}</a>`
      : messageData,
    theme: "light",
    layout: 1,
    progressBar: false,
    timeout: isHTML ? false : 3000,
    position: "topRight",
    backgroundColor: "#fbc500",
  };

  if (isHTML) {
    toastOptions.onClosed = () => {
      if (queuedMessages.length > 0) {
        showMessage(queuedMessages.shift(), true);
      }
    };
  }

  iziToast.show(toastOptions);
};
