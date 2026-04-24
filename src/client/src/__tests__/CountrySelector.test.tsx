// @vitest-environment jsdom
import { act, fireEvent } from "@testing-library/react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { CountrySelector } from "../CountrySelector";
import type { Country } from "../consts";

const sampleCountries: Country[] = [
  { id: "en_US", text: "United States" },
  { id: "es_AR", text: "Argentina" },
  { id: "en_AU", text: "Australia" },
];

function getDialog(container: HTMLElement): HTMLDialogElement {
  return container.querySelector("dialog.country-modal") as HTMLDialogElement;
}

function getOptionByText(container: HTMLElement, label: string): HTMLOptionElement | null {
  return (Array.from(container.querySelectorAll(".country-select-native option")).find(
    (el) => el.textContent?.trim() === label,
  ) ?? null) as HTMLOptionElement | null;
}

describe("CountrySelector", () => {
  it("renders the currently selected country", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () => {
      root.render(<CountrySelector value="es_AR" onChange={vi.fn()} countries={sampleCountries} />);
    });

    const selected = container.querySelector(".country-selected .country-name");
    expect(selected?.textContent).toBe("Argentina");

    await act(async () => {
      root.unmount();
    });
  });

  it("opens and closes on trigger button click", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () => {
      root.render(<CountrySelector value="en_US" onChange={vi.fn()} countries={sampleCountries} />);
    });

    const trigger = container.querySelector(".country-selected") as HTMLButtonElement;
    expect(getDialog(container).open).toBe(false);

    await act(async () => {
      trigger.click();
    });
    expect(getDialog(container).open).toBe(true);

    await act(async () => {
      trigger.click();
    });
    expect(getDialog(container).open).toBe(false);

    await act(async () => {
      root.unmount();
    });
  });

  it("filters countries by query", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () => {
      root.render(<CountrySelector value="en_US" onChange={vi.fn()} countries={sampleCountries} />);
    });

    const trigger = container.querySelector(".country-selected") as HTMLButtonElement;
    await act(async () => {
      trigger.click();
    });

    const input = container.querySelector(".country-search") as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: "arg" } });
    });

    expect(getOptionByText(container, "Argentina")).not.toBeNull();
    expect(getOptionByText(container, "United States")).toBeNull();
    expect(getOptionByText(container, "Australia")).toBeNull();

    await act(async () => {
      root.unmount();
    });
  });

  it("selects a country, calls onChange, and closes", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const onChange = vi.fn();

    await act(async () => {
      root.render(
        <CountrySelector value="en_US" onChange={onChange} countries={sampleCountries} />,
      );
    });

    const trigger = container.querySelector(".country-selected") as HTMLButtonElement;
    await act(async () => {
      trigger.click();
    });

    const select = container.querySelector(".country-select-native") as HTMLSelectElement;
    await act(async () => {
      fireEvent.change(select, { target: { value: "es_AR" } });
    });

    expect(onChange).toHaveBeenCalledWith("es_AR");
    expect(getDialog(container).open).toBe(false);

    await act(async () => {
      root.unmount();
    });
  });

  it("closes on Escape key", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () => {
      root.render(<CountrySelector value="en_US" onChange={vi.fn()} countries={sampleCountries} />);
    });

    const trigger = container.querySelector(".country-selected") as HTMLButtonElement;
    await act(async () => {
      trigger.click();
    });
    expect(getDialog(container).open).toBe(true);

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(getDialog(container).open).toBe(false);

    await act(async () => {
      root.unmount();
    });
  });

  it("closes on outside click", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<CountrySelector value="en_US" onChange={vi.fn()} countries={sampleCountries} />);
    });

    const trigger = host.querySelector(".country-selected") as HTMLButtonElement;
    await act(async () => {
      trigger.click();
    });
    expect(getDialog(host).open).toBe(true);

    await act(async () => {
      document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });
    expect(getDialog(host).open).toBe(false);

    await act(async () => {
      root.unmount();
    });
    host.remove();
  });

  it("closes on dialog backdrop click", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () => {
      root.render(<CountrySelector value="en_US" onChange={vi.fn()} countries={sampleCountries} />);
    });

    const trigger = container.querySelector(".country-selected") as HTMLButtonElement;
    await act(async () => {
      trigger.click();
    });
    const dlg = getDialog(container);
    expect(dlg.open).toBe(true);

    await act(async () => {
      fireEvent.click(dlg);
    });
    expect(dlg.open).toBe(false);

    await act(async () => {
      root.unmount();
    });
  });

  it("does not call onChange when the native select value is unchanged", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const onChange = vi.fn();

    await act(async () => {
      root.render(
        <CountrySelector value="en_US" onChange={onChange} countries={sampleCountries} />,
      );
    });

    const trigger = container.querySelector(".country-selected") as HTMLButtonElement;
    await act(async () => {
      trigger.click();
    });

    const select = container.querySelector(".country-select-native") as HTMLSelectElement;
    await act(async () => {
      fireEvent.change(select, { target: { value: "en_US" } });
    });

    expect(onChange).not.toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
  });

  it("uses the full country list in the native select when the filter matches nothing", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () => {
      root.render(<CountrySelector value="en_US" onChange={vi.fn()} countries={sampleCountries} />);
    });

    const trigger = container.querySelector(".country-selected") as HTMLButtonElement;
    await act(async () => {
      trigger.click();
    });

    const input = container.querySelector(".country-search") as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: "zzz" } });
    });

    expect(getOptionByText(container, "United States")).not.toBeNull();
    expect(getOptionByText(container, "Argentina")).not.toBeNull();

    await act(async () => {
      root.unmount();
    });
  });

  it("opens the dialog via open attribute when showModal is missing", async () => {
    const proto = HTMLDialogElement.prototype;
    const realShowModal = proto.showModal;
    Reflect.deleteProperty(proto, "showModal");

    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () => {
      root.render(<CountrySelector value="en_US" onChange={vi.fn()} countries={sampleCountries} />);
    });

    const trigger = container.querySelector(".country-selected") as HTMLButtonElement;
    await act(async () => {
      trigger.click();
    });

    const dlg = getDialog(container);
    expect(dlg.hasAttribute("open")).toBe(true);

    await act(async () => {
      trigger.click();
    });
    expect(dlg.hasAttribute("open")).toBe(false);

    if (realShowModal) Object.assign(proto, { showModal: realShowModal });

    await act(async () => {
      root.unmount();
    });
  });
});
