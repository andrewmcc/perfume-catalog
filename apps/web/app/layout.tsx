import type { Metadata, Viewport } from "next";
import { Bodoni_Moda, Figtree } from "next/font/google";
import { RegisterServiceWorker } from "@/components/register-service-worker";
import "./globals.css";

const bodoni = Bodoni_Moda({
  variable: "--font-bodoni",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
});

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Flacon", template: "%s · Flacon" },
  description: "Your perfume collection, catalogued.",
  appleWebApp: { capable: true, title: "Flacon", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#6E2A2A",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${bodoni.variable} ${figtree.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
