// components/ui/GlassButton.tsx
"use client";

import React from "react";

type GlassButtonVariant = "primary" | "secondary" | "ghost";

interface GlassButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: GlassButtonVariant;
  fullWidth?: boolean;
}

export const GlassButton: React.FC<GlassButtonProps> = ({
  children,
  variant = "primary",
  fullWidth = false,
  className,
  ...props
}) => {
  const baseClasses =
    "inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold transition active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed";

  let variantClasses = "";
  if (variant === "primary") {
    variantClasses =
      "bg-pink-500/90 text-white shadow-[0_12px_30px_rgba(236,72,153,0.55)] hover:bg-pink-400";
  } else if (variant === "secondary") {
    variantClasses =
      "bg-slate-900/60 text-slate-50 border border-white/15 hover:bg-slate-800/80";
  } else if (variant === "ghost") {
    variantClasses =
      "bg-transparent text-slate-300 hover:bg-slate-900/40 border border-transparent";
  }

  const widthClass = fullWidth ? "w-full" : "";
  const extraClass = className ?? "";

  const finalClassName = `${baseClasses} ${variantClasses} ${widthClass} ${extraClass}`.trim();

  return (
    <button className={finalClassName} {...props}>
      {children}
    </button>
  );
};
