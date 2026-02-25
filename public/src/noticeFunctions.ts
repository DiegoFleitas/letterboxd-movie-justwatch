import { getToastImpl } from "./toastApi";

let noticeId: string | number | null = null;
let noticeSetter: ((msg: string | null) => void) | null = null;

export function setNoticeImpl(setter: ((msg: string | null) => void) | null): void {
  noticeSetter = setter;
}

export function getNoticeImpl(): ((msg: string | null) => void) | null {
  return noticeSetter;
}

export const toggleNotice = (msg: string | null | undefined): void => {
  if (noticeSetter) {
    noticeSetter(msg ?? null);
    return;
  }
  const impl = getToastImpl();
  if (impl) {
    if (noticeId != null && impl.dismissLoading) {
      impl.dismissLoading(noticeId);
      noticeId = null;
    }
    if (msg && impl.loading) {
      noticeId = impl.loading(msg);
    }
    return;
  }
  if (typeof (globalThis as { iziToast?: unknown }).iziToast === "undefined") return;
  const notice = document.querySelector("#notice")?.closest?.(".iziToast-capsule");
  if (notice) {
    notice.remove();
    return;
  }
  if (msg) {
    try {
      (globalThis as { iziToast?: { show: (o: Record<string, unknown>) => void } }).iziToast?.show({
        id: "notice",
        title: "Please wait...",
        message: msg,
        theme: "dark",
        timeout: 10000,
      });
    } catch {
      // ignore
    }
  }
};

export const hideNotice = (): void => {
  const impl = getToastImpl();
  if (impl?.dismissLoading && noticeId != null) {
    impl.dismissLoading(noticeId);
    noticeId = null;
    return;
  }
  const notice = document.querySelector(".iziToast-capsule");
  if (notice) notice.remove();
};
