import React, { useEffect, useMemo, useRef, useState } from "react";
import { countries as allCountries } from "./consts";
import type { Country } from "./consts";

function getFlagCode(id: string | undefined): string {
  if (!id) return "";
  const parts = String(id).split("_");
  const countryPart = parts[1] || parts[0] || "";
  return countryPart.slice(-2).toLowerCase();
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

  const current = useMemo(
    () => countries.find((c) => c.id === value) ?? countries[0],
    [countries, value],
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return countries;
    const q = query.toLowerCase();
    return countries.filter((c) => c.text.toLowerCase().includes(q));
  }, [countries, query]);

  const displayCountries = useMemo(
    () => (filtered.length > 0 ? filtered : countries),
    [filtered, countries],
  );

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
        aria-controls="country-selector-panel"
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

      {open && (
        <div className="country-modal-anchor">
          <dialog
            id="country-selector-panel"
            className="country-modal"
            open
            aria-labelledby="country-modal-heading"
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
            <ul className="country-list" aria-label="Countries">
              {displayCountries.map((c) => {
                const code = getFlagCode(c.id);
                const selected = c.id === value;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      aria-current={selected ? "true" : undefined}
                      className={`country-list-item${selected ? " selected" : ""}`}
                      onClick={() => handleSelect(c.id)}
                    >
                      {code && (
                        <span
                          className={`flag-icon flag-icon-${code} country-flag`}
                          aria-hidden="true"
                        />
                      )}
                      <span className="country-name">{c.text}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </dialog>
        </div>
      )}
    </div>
  );
}
