// components/ui/PageShell.tsx
"use client";

import React from "react";

interface PageShellProps {
  title?: string;
  subtitle?: string;
  showBackButton?: boolean;
  onBack?: () => void;
  children: React.ReactNode;
}

export const PageShell: React.FC<PageShellProps> = ({
  title,
  subtitle,
  showBackButton = false,
  onBack,
  children,
}) => {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#1f2937,_#020617)] text-slate-50">
      {/* Safe area top iOS */}
      <div className="h-[env(safe-area-inset-top)]" />

      <div className="mx-auto flex max-w-md flex-col px-4 pb-4 pt-3">
        {(title || showBackButton) && (
          <header className="mb-4 flex items-center gap-3">
            {showBackButton && (
              <button
                type="button"
                onClick={onBack}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-slate-900/70 text-slate-100 backdrop-blur-md transition hover:bg-slate-800/80 active:scale-95"
              >
                ←
              </button>
            )}
            <div className="flex flex-col">
              {title && (
                <h1 className="text-lg font-semibold tracking-tight text-slate-50">
                  {title}
                </h1>
              )}
              {subtitle && (
                <p className="text-xs text-slate-400">{subtitle}</p>
              )}
            </div>
          </header>
        )}

        <main className="space-y-4">{children}</main>

        {/* Safe area bottom iOS */}
        <div className="h-[env(safe-area-inset-bottom)]" />
      </div>
    </div>
  );
};
