import type { Metadata, Viewport } from "next";
import "./globals.css";

// Pages render live tenant/session state; nothing is statically prerendered.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "GLAMOTION — beauty, try-on & motion studio", template: "%s · GLAMOTION" },
  description: "Shop cosmetics, preview shades on-device, and turn products into approved campaign videos.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#101016" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr">
      <body>
        <a href="#main" className="gm-skip">Skip to content</a>
        {children}
      </body>
    </html>
  );
}
