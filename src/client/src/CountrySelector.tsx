import React, { useEffect, useMemo, useRef, useState } from "react";
import { countries as allCountries } from "./consts";
import type { Country } from "./consts";

function getFlagCode(id: string | undefined): string {
  if (!id) return "";
  const parts = String(id).split("_");
  const countryPart = parts[1] || parts[0] || "";
  return countryPart.slice(-2).toLowerCase();
}

/** jsdom and some environments omit `HTMLDialogElement#showModal`; keep UX/tests working. */
function openCountryDialog(dlg: HTMLDialogElement): void {
  if (typeof dlg.showModal === "function") {
    dlg.showModal();
  } else {
    dlg.setAttribute("open", "");
  }
}

function closeCountryDialog(dlg: HTMLDialogElement): void {
  if (typeof dlg.close === "function") {
    dlg.close();
  } else {
    dlg.removeAttribute("open");
    dlg.dispatchEvent(new Event("close"));
  }
}

export interface CountrySelectorProps {
  readonly value: string;
  readonly onChange: (id: string) => void;
  readonly countries?: Country[];
}

export function CountrySelector({
  value,
  onChange,
  countries = allCountries,
}: CountrySelectorProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const current = useMemo(
    () => countries.find((c) => c.id === value) ?? countries[0],
    [countries, value],
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return countries;
    const q = query.toLowerCase();
    return countries.filter((c) => c.text.toLowerCase().includes(q));
  }, [countries, query]);

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (open) {
      if (!dlg.open) openCountryDialog(dlg);
    } else if (dlg.open) {
      closeCountryDialog(dlg);
    }
  }, [open]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent): void {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleSelect = (id: string): void => {
    if (id && id !== value) onChange(id);
    setOpen(false);
  };

  const currentCode = getFlagCode(current?.id);
  const selectOptions = filtered.length > 0 ? filtered : countries;
  const selectSize = Math.min(Math.max(selectOptions.length, 3), 14);

  return (
    <div
      id="country-selector"
      ref={containerRef}
      className={open ? "open" : ""}
      data-testid="country-selector"
    >
      <button
        type="button"
        className="country-selected"
        onClick={() => {
          setOpen((prev) => {
            const next = !prev;
            if (next) setQuery("");
            return next;
          });
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        {currentCode && (
          <span className={`flag-icon flag-icon-${currentCode} country-flag`} aria-hidden="true" />
        )}
        <span className="country-name">{current?.text}</span>
        <span className="country-arrow" aria-hidden="true">
          ▾
        </span>
      </button>

      {/* Backdrop click closes modal; Escape is handled by document listener + native dialog. */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- dialog element backdrop dismiss */}
      <dialog
        ref={dialogRef}
        className="country-modal"
        aria-labelledby="country-modal-heading"
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setOpen(false);
            const dlg = dialogRef.current;
            if (dlg) closeCountryDialog(dlg);
          }
        }}
      >
        <div className="country-modal-header" id="country-modal-heading">
          Country
        </div>
        <input
          type="text"
          className="country-search"
          placeholder="Type to filter countries"
          aria-label="Filter countries"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className="country-select-native"
          size={selectSize}
          value={value}
          aria-label="Countries"
          onChange={(e) => handleSelect(e.target.value)}
        >
          {selectOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.text}
            </option>
          ))}
        </select>
      </dialog>
    </div>
  );
}
