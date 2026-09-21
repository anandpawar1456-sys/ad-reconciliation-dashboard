import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ad Reconciliation Dashboard",
  description: "GHL vs Meta reconciliation, true ROAS, and attribution gap tracking.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100 min-h-screen">{children}</body>
    </html>
  );
}
