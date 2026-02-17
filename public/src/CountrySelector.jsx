import { useEffect, useMemo, useRef, useState } from "react";
import { countries as allCountries } from "./consts.js";

function getFlagCode(id) {
  if (!id) return "";
  const parts = String(id).split("_");
  const countryPart = parts[1] || parts[0] || "";
  return countryPart.slice(-2).toLowerCase();
}

export function CountrySelector({ value, onChange, countries = allCountries }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef(null);

  const current = useMemo(
    () => countries.find((c) => c.id === value) ?? countries[0],
    [countries, value]
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return countries;
    const q = query.toLowerCase();
    return countries.filter((c) => c.text.toLowerCase().includes(q));
  }, [countries, query]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e) {
      if (e.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleSelect = (id) => {
    if (id && id !== value) {
      onChange?.(id);
    }
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
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {currentCode && (
          <span
            className={`flag-icon flag-icon-${currentCode} country-flag`}
            aria-hidden="true"
          />
        )}
        <span className="country-name">{current?.text}</span>
        <span className="country-arrow" aria-hidden="true">
          ▾
        </span>
      </button>

      {open && (
        <div className="country-modal" role="dialog" aria-label="Select country">
          <div className="country-modal-header">Country</div>
          <input
            type="text"
            className="country-search"
            placeholder="Type to filter countries"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div
            className="country-list"
            role="listbox"
            aria-activedescendant={current?.id}
          >
            {filtered.map((c) => {
              const code = getFlagCode(c.id);
              const selected = c.id === current?.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
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
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

