import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Sans } from "next/font/google";
import { headers } from "next/headers";
import { getThemeConfig } from "@/src/lib/theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
});

const baseMetadata: Metadata = {
  title: "Morphly — AI Video Generation Powered by LTX 2.3",
  description:
    "Create cinematic videos from text, images and existing footage with Morphly’s LTX 2.3-powered creative studio.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "ai.morphly.fun";
  const forwardedProtocol = requestHeaders.get("x-forwarded-proto");
  const protocol =
    forwardedProtocol === "http" || forwardedProtocol === "https"
      ? forwardedProtocol
      : host.startsWith("localhost")
        ? "http"
        : "https";
  const origin = new URL(`${protocol}://${host}`).origin;
  const imageUrl = `${origin}/og-v2.png`;

  return {
    ...baseMetadata,
    metadataBase: new URL(origin),
    alternates: {
      canonical: origin,
    },
    openGraph: {
      title: baseMetadata.title as string,
      description: baseMetadata.description ?? undefined,
      siteName: "Morphly",
      type: "website",
      url: origin,
      images: [{ url: imageUrl, alt: "Morphly AI video generation powered by LTX 2.3" }],
    },
    twitter: {
      card: "summary_large_image",
      title: baseMetadata.title as string,
      description: baseMetadata.description ?? undefined,
      images: [imageUrl],
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const theme = await getThemeConfig();

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${instrumentSans.variable} antialiased`}
        style={{
          '--bg': theme.bg,
          '--panel': theme.panel,
          '--panel2': theme.panel2,
          '--text': theme.text,
          '--lime': theme.lime,
          '--yellow': theme.yellow,
        } as React.CSSProperties}
      >
        {children}
      </body>
    </html>
  );
}
