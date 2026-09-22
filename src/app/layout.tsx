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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
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
