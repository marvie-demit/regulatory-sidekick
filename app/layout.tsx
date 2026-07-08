import type { Metadata } from "next";
import { Geist, Fraunces } from "next/font/google";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "Regulatory Sidekick",
    template: "%s · Regulatory Sidekick",
  },
  description:
    "A stepwise implementation for EU MDR and IVDR — including setting up your QMS under ISO 13485 and key FDA QMSR (21 CFR 820) — made for medical-device manufacturers. Your regulatory sidekick.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geist.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
