"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
};

const navItems: NavItem[] = [
  {
    href: "/",
    label: "Home",
    icon: "🏠",
  },
  {
    href: "/calendar",
    label: "Calendario",
    icon: "📅",
  },
  {
    href: "/shopping",
    label: "Lista",
    icon: "🛒",
  },
    {
    href: "/profile",
    label: "Profilo",
    icon: "👤",
  },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-slate-900/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-md items-center justify-around px-4 py-2">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center text-xs"
            >
              <span
                className={
                  "mb-1 text-lg" + (isActive ? " scale-110" : " opacity-80")
                }
              >
                {item.icon}
              </span>
              <span
                className={
                  "font-medium " +
                  (isActive ? "text-pink-400" : "text-slate-300")
                }
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
