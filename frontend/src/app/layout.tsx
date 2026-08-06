import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import { APP_DESCRIPTION, APP_NAME, FAVICON, SITE_URL } from "@/constants/app";
import AppProviders from "@/providers/AppProviders";

/**
 * Self-hosted by next/font with `display: swap` and a size-adjusted fallback,
 * so text paints immediately in a metric-matched system font and the swap to
 * Poppins doesn't reflow the line boxes.
 */
const poppins = Poppins({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
  fallback: ["system-ui", "arial"],
  adjustFontFallback: true,
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: APP_NAME,
    template: `%s · ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  icons: {
    icon: { url: FAVICON, sizes: "512x512", type: "image/png" },
    apple: FAVICON,
  },
  openGraph: {
    type: "website",
    siteName: APP_NAME,
    title: APP_NAME,
    description: APP_DESCRIPTION,
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: APP_NAME,
    description: APP_DESCRIPTION,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Pinch-zoom stays available — capping it would fail an accessibility audit.
  maximumScale: 5,
  viewportFit: "cover",
  // The app is light-only, so the browser chrome should match rather than
  // following the visitor's OS preference.
  colorScheme: "light",
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={poppins.variable}>
      <head>
        {/* Opens the connection to the API before the first data request. */}
        <link
          rel="preconnect"
          href={process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000"}
          crossOrigin="anonymous"
        />
        <link rel="preconnect" href="https://res.cloudinary.com" crossOrigin="anonymous" />
      </head>
      <body className="font-sans antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
