export const toggleNotice = (msg) => {
  const notice = document.querySelectorAll("#notice")?.[0];
  if (notice) {
    // remove iziToast-capsule to avoid stacking
    notice.parentElement.remove();
    return;
  }

  try {
    iziToast.show({
      id: "notice",
      title: "Please wait...",
      message: msg,
      theme: "dark",
      progressBarColor: "#5DA5DA",
      progressBarEasing: "linear",
      timeout: 10000, // 10s
    });
  } catch (error) {
    // normal to get an error here, but it's ok
  }
};

export const hideNotice = () => {
  const notice = document.querySelector(".iziToast-capsule")?.[0];
  if (notice) notice.remove();
};
