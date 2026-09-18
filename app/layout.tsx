import type { Metadata, Viewport } from "next";
import { Fredoka, Nunito } from "next/font/google";
import "./globals.css";

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Slice",
  description:
    "A voice-first maths playground for K–5. The child talks; the screen does what they say.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Slice",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#7ecdf5",
  width: "device-width",
  initialScale: 1,
  // A child will double-tap things. Let them, without zooming the app.
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${fredoka.variable} ${nunito.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
