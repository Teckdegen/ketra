import type { Metadata } from "next";
import { Instrument_Sans } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { Shell } from "./shell";

const sans = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Ketra",
  description: "The account holds the assets. An ML-DSA-44 signature moves them.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} h-full antialiased`}>
      <body className={`${sans.className} min-h-full`}>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(window.top!==window.self)document.documentElement.classList.add("ketra-embed")}catch(e){}`,
          }}
        />
        <Suspense fallback={<div className="min-h-screen">{children}</div>}>
          <Shell>{children}</Shell>
        </Suspense>
      </body>
    </html>
  );
}
