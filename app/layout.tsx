import type { Metadata } from "next";
import "./globals.css";
import { BottomNav } from "@/components/BottomNav";

export const metadata: Metadata = {
  title: "noizb",
  description: "La nostra app di coppia",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it">
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#050816" />

        {/* iOS full screen */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <meta name="apple-mobile-web-app-title" content="noizb" />

        {/* Icona iPhone */}
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>

      <body className="bg-slate-950 text-slate-50">
        <div className="mx-auto flex min-h-screen max-w-md flex-col bg-slate-950">
          <main className="flex-1 pb-20 px-4 pt-6">{children}</main>
          <BottomNav />
        </div>
      </body>
    </html>
  );
}
