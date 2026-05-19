"use client";

import { useId } from "react";
import { normalizeHex } from "@/lib/colors";

interface Props {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}

export function PixelColorPicker({ label, value, onChange }: Props) {
  const id = useId();
  const hex = normalizeHex(value);
  const hexInput = hex.replace("#", "");

  const applyHex = (raw: string) => {
    const cleaned = raw.replace(/[^0-9a-fA-F]/g, "").slice(0, 6);
    if (cleaned.length === 3 || cleaned.length === 6) {
      onChange(normalizeHex(cleaned));
    }
  };

  return (
    <div className="pixel-color-picker">
      <label className="pixel-label" htmlFor={id}>
        {label}
      </label>
      <div className="pixel-color-picker__row">
        <label
          className="pixel-color-picker__trigger"
          htmlFor={id}
          style={{ background: hex }}
          aria-label={`${label}: ${hex}`}
        >
          <span className="pixel-color-picker__trigger-shine" />
        </label>
        <input
          id={id}
          type="color"
          className="pixel-color-picker__native"
          value={hex}
          onChange={(e) => onChange(normalizeHex(e.target.value))}
        />
        <div className="pixel-color-picker__hex-wrap">
          <span className="pixel-color-picker__hash">#</span>
          <input
            type="text"
            className="pixel-input pixel-color-picker__hex"
            value={hexInput}
            maxLength={6}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            onChange={(e) => applyHex(e.target.value)}
            onBlur={(e) => applyHex(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
