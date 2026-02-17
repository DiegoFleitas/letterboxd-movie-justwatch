import { getToastImpl } from "./toastApi.js";

let noticeId = null;
let noticeSetter = null;

export function setNoticeImpl(setter) {
  noticeSetter = setter;
}

export function getNoticeImpl() {
  return noticeSetter;
}

export const toggleNotice = (msg) => {
  if (noticeSetter) {
    noticeSetter(msg ?? null);
    return;
  }
  const impl = getToastImpl();
  if (impl) {
    if (noticeId != null) {
      impl.dismissLoading(noticeId);
      noticeId = null;
    }
    if (msg) {
      noticeId = impl.loading(msg);
    }
    return;
  }
  if (typeof iziToast === "undefined") return;
  const notice = document.querySelector("#notice")?.closest?.(".iziToast-capsule");
  if (notice) {
    notice.remove();
    return;
  }
  if (msg) {
    try {
      iziToast.show({
        id: "notice",
        title: "Please wait...",
        message: msg,
        theme: "dark",
        timeout: 10000,
      });
    } catch (e) {}
  }
};

export const hideNotice = () => {
  const impl = getToastImpl();
  if (impl?.dismissLoading && noticeId != null) {
    impl.dismissLoading(noticeId);
    noticeId = null;
    return;
  }
  const notice = document.querySelector(".iziToast-capsule");
  if (notice) notice.remove();
};
