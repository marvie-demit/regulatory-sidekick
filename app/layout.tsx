import type { Metadata } from "next";
import { Geist, Fraunces } from "next/font/google";
import { getRequestBrand } from "@/lib/partners/brand";
import { brandName } from "@/lib/partners/theme";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"] });

const DESCRIPTION =
  "A stepwise implementation for EU MDR and IVDR — including setting up your QMS under ISO 13485 and key FDA QMSR (21 CFR 820) — made for medical-device manufacturers. Your regulatory sidekick.";

// The browser-tab title is as visible as anything on the page, so it carries the
// partner's name on their subdomain. getRequestBrand() reads the proxy-injected
// header, which makes these routes dynamic — a deliberate trade: `/`,
// `/impressum` and `/privacy` were the only prerendered pages, and they are
// exactly the ones a partner's visitors land on first.
export async function generateMetadata(): Promise<Metadata> {
  const name = brandName(await getRequestBrand());
  return {
    title: { default: name, template: `%s · ${name}` },
    description: DESCRIPTION,
  };
}

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
