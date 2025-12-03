// components/ui/GlassInput.tsx
"use client";

import React, {
  forwardRef,
  type InputHTMLAttributes,
  type ForwardedRef,
} from "react";

interface GlassInputProps
  extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: React.ReactNode;
  errorText?: React.ReactNode;
}

export const GlassInput = forwardRef<HTMLInputElement, GlassInputProps>(
  ({ label, helperText, errorText, className, ...props }, ref) => {
    const hasError = Boolean(errorText);

    const baseClasses =
      "w-full rounded-xl border px-3 py-2 text-sm bg-slate-900/70 text-slate-50 placeholder:text-slate-500 backdrop-blur-lg outline-none focus:ring-1 focus:ring-pink-500/80";
    const borderClasses = hasError
      ? "border-pink-500/70"
      : "border-white/10 focus:border-pink-400";
    const extraClass = className ?? "";
    const finalClassName = `${baseClasses} ${borderClasses} ${extraClass}`.trim();

    return (
      <div className="space-y-1.5">
        {label && (
          <label className="text-xs font-medium text-slate-300">
            {label}
          </label>
        )}

        <input
          ref={ref as ForwardedRef<HTMLInputElement>}
          className={finalClassName}
          {...props}
        />

        {helperText && !errorText && (
          <p className="text-[10px] text-slate-400">{helperText}</p>
        )}
        {errorText && (
          <p className="text-[10px] text-pink-300">{errorText}</p>
        )}
      </div>
    );
  }
);

GlassInput.displayName = "GlassInput";
