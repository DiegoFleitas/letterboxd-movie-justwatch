import { afterEach, describe, expect, it, vi } from "vitest";
import { hideNotice, setNoticeImpl } from "../noticeFunctions";

describe("noticeFunctions", () => {
  afterEach(() => {
    setNoticeImpl(null);
  });

  it("hideNotice clears React notice when setter is registered", () => {
    const setter = vi.fn();
    setNoticeImpl(setter);

    hideNotice();

    expect(setter).toHaveBeenCalledWith(null);
  });
});
