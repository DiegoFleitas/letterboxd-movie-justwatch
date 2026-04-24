// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { hideNotice, setNoticeImpl, toggleNotice } from "../noticeFunctions";
import { setToastImpl } from "../toastApi";

describe("noticeFunctions", () => {
  afterEach(() => {
    setNoticeImpl(null);
    setToastImpl(null);
  });

  it("toggleNotice removes existing izi capsule near #notice", () => {
    (globalThis as { iziToast?: object }).iziToast = {};
    const notice = document.createElement("div");
    notice.id = "notice";
    const capsule = document.createElement("div");
    capsule.className = "iziToast-capsule";
    capsule.appendChild(notice);
    document.body.appendChild(capsule);
    toggleNotice(null);
    expect(document.querySelector(".iziToast-capsule")).toBeNull();
    document.body.innerHTML = "";
    delete (globalThis as { iziToast?: object }).iziToast;
  });

  it("hideNotice removes izi capsule when no toast impl", () => {
    const capsule = document.createElement("div");
    capsule.className = "iziToast-capsule";
    document.body.appendChild(capsule);
    hideNotice();
    expect(document.querySelector(".iziToast-capsule")).toBeNull();
    document.body.innerHTML = "";
  });

  it("toggleNotice uses loading toast when impl is set", () => {
    const loading = vi.fn(() => "lid");
    const dismissLoading = vi.fn();
    setToastImpl({
      success: vi.fn(),
      error: vi.fn(),
      loading,
      dismissLoading,
    });
    toggleNotice("please wait");
    expect(loading).toHaveBeenCalledWith("please wait");
    toggleNotice(null);
    expect(dismissLoading).toHaveBeenCalledWith("lid");
  });

  it("hideNotice clears React notice when setter is registered", () => {
    const setter = vi.fn();
    setNoticeImpl(setter);

    hideNotice();

    expect(setter).toHaveBeenCalledWith(null);
  });
});
