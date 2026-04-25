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

function getDialog(container: HTMLElement): HTMLDialogElement {
  return container.querySelector("dialog.country-modal") as HTMLDialogElement;
}

function getOptionByText(container: HTMLElement, label: string): HTMLOptionElement | null {
  return (Array.from(container.querySelectorAll(".country-select-native option")).find(
    (el) => el.textContent?.trim() === label,
  ) ?? null) as HTMLOptionElement | null;
}

function getTrigger(container: HTMLElement): HTMLButtonElement {
  return container.querySelector(".country-selected") as HTMLButtonElement;
}

function getNativeSelect(container: HTMLElement): HTMLSelectElement {
  return container.querySelector(".country-select-native") as HTMLSelectElement;
}

function getSearchInput(container: HTMLElement): HTMLInputElement {
  return container.querySelector(".country-search") as HTMLInputElement;
}

async function openCountryModal(container: HTMLElement): Promise<void> {
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
      expect(getDialog(container).open).toBe(false);

      await openCountryModal(container);
      expect(getDialog(container).open).toBe(true);

      await openCountryModal(container);
      expect(getDialog(container).open).toBe(false);
    });
  });

  it("filters countries by query", async () => {
    await withRootRender(countrySelector(), async ({ container }) => {
      await openCountryModal(container);

      const input = getSearchInput(container);
      await act(async () => {
        fireEvent.change(input, { target: { value: "arg" } });
      });

      expect(getOptionByText(container, "Argentina")).not.toBeNull();
      expect(getOptionByText(container, "United States")).toBeNull();
      expect(getOptionByText(container, "Australia")).toBeNull();
    });
  });

  it("selects a country, calls onChange, and closes", async () => {
    const onChange = vi.fn();
    await withRootRender(countrySelector({ onChange }), async ({ container }) => {
      await openCountryModal(container);

      const select = getNativeSelect(container);
      await act(async () => {
        fireEvent.change(select, { target: { value: "es_AR" } });
      });

      expect(onChange).toHaveBeenCalledWith("es_AR");
      expect(getDialog(container).open).toBe(false);
    });
  });

  it("closes on Escape key", async () => {
    await withRootRender(countrySelector(), async ({ container }) => {
      await openCountryModal(container);
      expect(getDialog(container).open).toBe(true);

      await act(async () => {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      });
      expect(getDialog(container).open).toBe(false);
    });
  });

  it("closes on outside click", async () => {
    await withMountedInBody(countrySelector(), async ({ container: host }) => {
      await openCountryModal(host);
      expect(getDialog(host).open).toBe(true);

      await act(async () => {
        document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      });
      expect(getDialog(host).open).toBe(false);
    });
  });

  it("closes on dialog backdrop click", async () => {
    await withRootRender(countrySelector(), async ({ container }) => {
      await openCountryModal(container);
      const dlg = getDialog(container);
      expect(dlg.open).toBe(true);

      await act(async () => {
        fireEvent.click(dlg);
      });
      expect(dlg.open).toBe(false);
    });
  });

  it("does not call onChange when the native select value is unchanged", async () => {
    const onChange = vi.fn();
    await withRootRender(countrySelector({ onChange }), async ({ container }) => {
      await openCountryModal(container);

      const select = getNativeSelect(container);
      await act(async () => {
        fireEvent.change(select, { target: { value: "en_US" } });
      });

      expect(onChange).not.toHaveBeenCalled();
    });
  });

  it("uses the full country list in the native select when the filter matches nothing", async () => {
    await withRootRender(countrySelector(), async ({ container }) => {
      await openCountryModal(container);

      const input = getSearchInput(container);
      await act(async () => {
        fireEvent.change(input, { target: { value: "zzz" } });
      });

      expect(getOptionByText(container, "United States")).not.toBeNull();
      expect(getOptionByText(container, "Argentina")).not.toBeNull();
    });
  });

  it("opens the dialog via open attribute when showModal is missing", async () => {
    const proto = HTMLDialogElement.prototype;
    const realShowModal = proto.showModal;
    Reflect.deleteProperty(proto, "showModal");
    try {
      await withRootRender(countrySelector(), async ({ container }) => {
        await openCountryModal(container);

        const dlg = getDialog(container);
        expect(dlg.hasAttribute("open")).toBe(true);

        await openCountryModal(container);
        expect(dlg.hasAttribute("open")).toBe(false);
      });
    } finally {
      if (realShowModal) Object.assign(proto, { showModal: realShowModal });
    }
  });
});
