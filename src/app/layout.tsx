import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import PWARegister from "@/components/PWARegister";
import UpdateAvailable from "@/components/UpdateAvailable";
import { ToastProvider } from "@/components/toast";
import { BusinessAuthProvider } from "@/lib/business-auth-context";
import { RiderAuthProvider } from "@/lib/rider-auth-context";
import { THEME_INIT_SCRIPT, ThemePreferenceProvider } from "@/lib/theme-preference-context";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Distro",
  description: "Stock, shop and payment tracker for distribution businesses",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#1d4e89",
};

// Every screen's first data fetch (session check, then whatever the page
// needs) hits this origin — warming the DNS/TLS handshake before that
// request is made shaves a full round trip off it, which matters most on
// higher-latency mobile connections.
function supabaseOrigin(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabaseUrl = supabaseOrigin();

  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        {supabaseUrl ? (
          <>
            <link rel="preconnect" href={supabaseUrl} crossOrigin="anonymous" />
            <link rel="dns-prefetch" href={supabaseUrl} />
          </>
        ) : null}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        <PWARegister />
        <UpdateAvailable />
        <ThemePreferenceProvider>
          <RiderAuthProvider>
            <BusinessAuthProvider>
              <ToastProvider>{children}</ToastProvider>
            </BusinessAuthProvider>
          </RiderAuthProvider>
        </ThemePreferenceProvider>
      </body>
    </html>
  );
}
