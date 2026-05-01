// @vitest-environment jsdom
import type { ReactElement } from "react";
import { act, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CountrySelector } from "../CountrySelector";
import type { Country } from "../consts";
import { withMountedInBody, withRootRender } from "./reactRootTestUtils";

const sampleCountries: Country[] = [
  { id: "en_US", text: "United States" },
  { id: "es_AR", text: "Argentina" },
  { id: "en_AU", text: "Australia" },
];

function countrySelector(
  overrides: Partial<{ value: string; onChange: (id: string) => void }> = {},
): ReactElement {
  return (
    <CountrySelector
      countries={sampleCountries}
      value={overrides.value ?? "en_US"}
      onChange={overrides.onChange ?? vi.fn()}
    />
  );
}

function isDropdownOpen(container: HTMLElement): boolean {
  return container.querySelector("#country-selector")?.classList.contains("open") ?? false;
}

function getModal(container: HTMLElement): HTMLElement | null {
  return container.querySelector(".country-modal");
}

function getTrigger(container: HTMLElement): HTMLButtonElement {
  return container.querySelector(".country-selected") as HTMLButtonElement;
}

function getSearchInput(container: HTMLElement): HTMLInputElement {
  return container.querySelector(".country-search") as HTMLInputElement;
}

function getCountryButton(container: HTMLElement, label: string): HTMLButtonElement {
  for (const nameEl of container.querySelectorAll(".country-list .country-name")) {
    if (nameEl.textContent?.trim() === label) {
      return nameEl.closest("button") as HTMLButtonElement;
    }
  }
  throw new Error(`Country button not found: ${label}`);
}

async function openCountryDropdown(container: HTMLElement): Promise<void> {
  await act(async () => {
    getTrigger(container).click();
  });
}

describe("CountrySelector", () => {
  it("renders the currently selected country", async () => {
    await withRootRender(countrySelector({ value: "es_AR" }), async ({ container }) => {
      const selected = container.querySelector(".country-selected .country-name");
      expect(selected?.textContent).toBe("Argentina");
    });
  });

  it("opens and closes on trigger button click", async () => {
    await withRootRender(countrySelector(), async ({ container }) => {
      expect(isDropdownOpen(container)).toBe(false);
      expect(getModal(container)).toBeNull();

      await openCountryDropdown(container);
      expect(isDropdownOpen(container)).toBe(true);
      expect(getModal(container)).not.toBeNull();

      await openCountryDropdown(container);
      expect(isDropdownOpen(container)).toBe(false);
      expect(getModal(container)).toBeNull();
    });
  });

  it("filters countries by query", async () => {
    await withRootRender(countrySelector(), async ({ container }) => {
      await openCountryDropdown(container);

      const input = getSearchInput(container);
      await act(async () => {
        fireEvent.change(input, { target: { value: "arg" } });
      });

      const items = container.querySelectorAll(".country-list-item .country-name");
      const labels = Array.from(items).map((el) => el.textContent?.trim());
      expect(labels).toContain("Argentina");
      expect(labels).not.toContain("United States");
      expect(labels).not.toContain("Australia");
    });
  });

  it("selects a country, calls onChange, and closes", async () => {
    const onChange = vi.fn();
    await withRootRender(countrySelector({ onChange }), async ({ container }) => {
      await openCountryDropdown(container);

      const argentina = getCountryButton(container, "Argentina");
      await act(async () => {
        fireEvent.click(argentina);
      });

      expect(onChange).toHaveBeenCalledWith("es_AR");
      expect(isDropdownOpen(container)).toBe(false);
    });
  });

  it("closes on Escape key", async () => {
    await withRootRender(countrySelector(), async ({ container }) => {
      await openCountryDropdown(container);
      expect(isDropdownOpen(container)).toBe(true);

      await act(async () => {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      });
      expect(isDropdownOpen(container)).toBe(false);
    });
  });

  it("closes on outside click", async () => {
    await withMountedInBody(countrySelector(), async ({ container: host }) => {
      await openCountryDropdown(host);
      expect(isDropdownOpen(host)).toBe(true);

      await act(async () => {
        document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      });
      expect(isDropdownOpen(host)).toBe(false);
    });
  });

  it("does not call onChange when selecting the current value", async () => {
    const onChange = vi.fn();
    await withRootRender(countrySelector({ onChange }), async ({ container }) => {
      await openCountryDropdown(container);

      const us = getCountryButton(container, "United States");
      await act(async () => {
        fireEvent.click(us);
      });

      expect(onChange).not.toHaveBeenCalled();
    });
  });

  it("shows the full country list when the filter matches nothing", async () => {
    await withRootRender(countrySelector(), async ({ container }) => {
      await openCountryDropdown(container);

      const input = getSearchInput(container);
      await act(async () => {
        fireEvent.change(input, { target: { value: "zzz" } });
      });

      const items = container.querySelectorAll(".country-list-item .country-name");
      const labels = Array.from(items).map((el) => el.textContent?.trim());
      expect(labels).toContain("United States");
      expect(labels).toContain("Argentina");
    });
  });

  it("falls back to the first country when the value is missing from the list", async () => {
    await withRootRender(countrySelector({ value: "xx_XX" }), async ({ container }) => {
      const selected = container.querySelector(".country-selected .country-name");
      expect(selected?.textContent).toBe("United States");
    });
  });

  it("clears the filter when reopening the panel", async () => {
    await withRootRender(countrySelector(), async ({ container }) => {
      await openCountryDropdown(container);
      await act(async () => {
        fireEvent.change(getSearchInput(container), { target: { value: "arg" } });
      });
      expect(container.querySelectorAll(".country-list-item .country-name")).toHaveLength(1);

      await openCountryDropdown(container);
      await openCountryDropdown(container);

      expect(getSearchInput(container).value).toBe("");
      expect(container.querySelectorAll(".country-list-item .country-name")).toHaveLength(3);
    });
  });

  it("anchors the dialog inside .country-modal-anchor for layout", async () => {
    await withRootRender(countrySelector(), async ({ container }) => {
      await openCountryDropdown(container);
      const anchor = container.querySelector(".country-modal-anchor");
      const dialog = getModal(container);
      expect(anchor).not.toBeNull();
      expect(dialog?.parentElement).toBe(anchor);
      expect(dialog?.id).toBe("country-selector-panel");
      expect(dialog?.getAttribute("aria-labelledby")).toBe("country-modal-heading");
    });
  });

  it("exposes dialog semantics on the trigger while closed", async () => {
    await withRootRender(countrySelector(), async ({ container }) => {
      const trigger = getTrigger(container);
      expect(trigger.getAttribute("aria-haspopup")).toBe("dialog");
      expect(trigger.getAttribute("aria-controls")).toBe("country-selector-panel");
      expect(trigger.getAttribute("aria-expanded")).toBe("false");
    });
  });

  it("sets aria-expanded while open", async () => {
    await withRootRender(countrySelector(), async ({ container }) => {
      await openCountryDropdown(container);
      expect(getTrigger(container).getAttribute("aria-expanded")).toBe("true");
    });
  });

  it("marks the current value row with aria-current", async () => {
    await withRootRender(countrySelector({ value: "es_AR" }), async ({ container }) => {
      await openCountryDropdown(container);
      const selected = container.querySelector("button.country-list-item.selected");
      expect(selected?.getAttribute("aria-current")).toBe("true");
      for (const btn of container.querySelectorAll("button.country-list-item:not(.selected)")) {
        expect(btn.getAttribute("aria-current")).toBeNull();
      }
    });
  });

  it("derives flag sprite class from the region suffix of the id", async () => {
    await withRootRender(countrySelector({ value: "en_US" }), async ({ container }) => {
      expect(container.querySelector(".country-selected .flag-icon-us")).not.toBeNull();
    });
    await withRootRender(countrySelector({ value: "en_AU" }), async ({ container }) => {
      expect(container.querySelector(".country-selected .flag-icon-au")).not.toBeNull();
    });
  });
});
