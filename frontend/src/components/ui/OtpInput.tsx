"use client";

import { useRef, type ClipboardEvent, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";

export interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  disabled?: boolean;
  error?: string;
  /** Fired when the last box is filled, so the form can submit itself. */
  onComplete?: (value: string) => void;
}

/** Six separate boxes that behave like one field for typing, pasting and SMS autofill. */
export default function OtpInput({
  value,
  onChange,
  length = 6,
  disabled,
  error,
  onComplete,
}: OtpInputProps) {
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  const commit = (next: string) => {
    onChange(next);
    if (next.length === length) onComplete?.(next);
  };

  const handleChange = (index: number, raw: string) => {
    const digits = raw.replace(/\D/g, "");
    if (!digits) return;

    // Typing into a box overwrites it; a multi-digit paste fills forward.
    const chars = value.padEnd(length, " ").split("");
    for (let offset = 0; offset < digits.length && index + offset < length; offset++) {
      chars[index + offset] = digits[offset];
    }

    const next = chars.join("").trimEnd().slice(0, length);
    commit(next);

    const focusIndex = Math.min(index + digits.length, length - 1);
    inputsRef.current[focusIndex]?.focus();
  };

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace") {
      event.preventDefault();
      const chars = value.padEnd(length, " ").split("");

      if (chars[index] && chars[index] !== " ") {
        chars[index] = " ";
        commit(chars.join("").trimEnd());
      } else if (index > 0) {
        chars[index - 1] = " ";
        commit(chars.join("").trimEnd());
        inputsRef.current[index - 1]?.focus();
      }
      return;
    }

    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      inputsRef.current[index - 1]?.focus();
    }
    if (event.key === "ArrowRight" && index < length - 1) {
      event.preventDefault();
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const digits = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!digits) return;
    commit(digits);
    inputsRef.current[Math.min(digits.length, length - 1)]?.focus();
  };

  return (
    <div>
      <div className="flex justify-center gap-2 tab:gap-3">
        {Array.from({ length }, (_, index) => (
          <input
            key={index}
            ref={(element) => {
              inputsRef.current[index] = element;
            }}
            type="text"
            inputMode="numeric"
            // Lets iOS/Android offer the code straight from the SMS or email.
            autoComplete={index === 0 ? "one-time-code" : "off"}
            maxLength={length}
            disabled={disabled}
            value={value[index] ?? ""}
            aria-label={`Digit ${index + 1}`}
            onChange={(event) => handleChange(index, event.target.value)}
            onKeyDown={(event) => handleKeyDown(index, event)}
            onPaste={handlePaste}
            onFocus={(event) => event.target.select()}
            className={cn(
              "h-12 w-11 rounded-lg bg-surface text-center text-lg font-semibold text-content tab:h-14 tab:w-12",
              "ring-1 ring-inset ring-line focus:ring-2 focus:ring-brand focus:outline-none",
              "disabled:cursor-not-allowed disabled:bg-surface-muted",
              error && "ring-danger focus:ring-danger"
            )}
          />
        ))}
      </div>

      {error && <p className="mt-2 text-center text-xs text-danger">{error}</p>}
    </div>
  );
}
