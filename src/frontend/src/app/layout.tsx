import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "./providers";
import { Toaster } from "@/components/ui/sonner";

// "Modern ledger" type system: Hanken Grotesk for UI/body, Space Grotesk for
// display headings, JetBrains Mono for every figure (tabular).
const sans = localFont({
  src: "../../node_modules/@fontsource-variable/hanken-grotesk/files/hanken-grotesk-latin-wght-normal.woff2",
  variable: "--font-sans",
  weight: "100 900",
  display: "swap",
});

const display = localFont({
  src: "../../node_modules/@fontsource-variable/space-grotesk/files/space-grotesk-latin-wght-normal.woff2",
  variable: "--font-display",
  weight: "300 700",
  display: "swap",
});

const mono = localFont({
  src: "../../node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2",
  variable: "--font-mono",
  weight: "100 800",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ledgerly",
  description: "Personal net worth and expense tracker",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "Ledgerly",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#1c7a4d",
};

/** Renders the root HTML shell, fonts, global providers, and toast host. */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${display.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <Providers>{children}</Providers>
        <Toaster
          richColors
          position="bottom-center"
          offset={{ bottom: 24 }}
          mobileOffset={{ bottom: "calc(5.75rem + env(safe-area-inset-bottom))", left: 8, right: 8 }}
        />
      </body>
    </html>
  );
}
