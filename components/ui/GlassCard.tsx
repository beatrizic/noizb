// components/ui/GlassCard.tsx
"use client";

import React from "react";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className,
}) => {
  const baseClasses =
    "rounded-2xl border border-white/12 bg-slate-900/60 backdrop-blur-xl shadow-[0_18px_45px_rgba(15,23,42,0.7)] px-4 py-4 space-y-3";

  const finalClassName = className
    ? `${baseClasses} ${className}`
    : baseClasses;

  return <section className={finalClassName}>{children}</section>;
};
