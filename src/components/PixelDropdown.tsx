"use client";

import { useEffect, useId, useRef, useState } from "react";

export interface PixelDropdownOption {
  value: string;
  label: string;
}

interface Props {
  value: string;
  options: PixelDropdownOption[];
  onChange: (value: string) => void;
  ariaLabel?: string;
}

export function PixelDropdown({
  value,
  options,
  onChange,
  ariaLabel = "Select",
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const selected =
    options.find((o) => o.value === value) ?? options[0] ?? null;

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <div
      ref={rootRef}
      className={`pixel-dropdown${open ? " pixel-dropdown--open" : ""}`}
    >
      <button
        type="button"
        className="pixel-dropdown__trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="pixel-dropdown__value">
          {selected?.label ?? "—"}
        </span>
        <span className="pixel-dropdown__caret" aria-hidden>
          ▼
        </span>
      </button>

      {open && (
        <ul id={listId} className="pixel-dropdown__panel" role="listbox">
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <li key={opt.value || "__all__"} role="none">
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`pixel-dropdown__item${active ? " pixel-dropdown__item--active" : ""}`}
                  onClick={() => pick(opt.value)}
                >
                  <span className="pixel-dropdown__check" aria-hidden>
                    {active ? "▸" : ""}
                  </span>
                  <span className="pixel-dropdown__item-label">{opt.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
