import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Ad Reconciliation Dashboard",
  description: "GHL vs Meta reconciliation, true ROAS, and attribution gap tracking.",
};

// Without this, mobile browsers lay the page out in a default ~980px
// virtual viewport and shrink it to fit the screen — every responsive
// class (sm:/md: breakpoints, the mobile nav) then evaluates against
// that fake 980px width instead of the phone's real width, so the site
// looks like a zoomed-out desktop page until the visitor manually
// pinch-zooms in.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body>{children}</body>
    </html>
  );
}
