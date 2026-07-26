import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const baseMetadata: Metadata = {
  title: "Morphly — AI video, directed by you",
  description:
    "Create cinematic AI video from text, images, or footage with Morphly and LTX 2.3.",
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
  const imageUrl = `${origin}/og.png`;

  return {
    ...baseMetadata,
    metadataBase: new URL(origin),
    openGraph: {
      title: "Morphly — Your idea. Now in motion.",
      description: baseMetadata.description ?? undefined,
      type: "website",
      url: origin,
      images: [{ url: imageUrl, width: 1731, height: 909, alt: "Morphly" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Morphly — Your idea. Now in motion.",
      description: baseMetadata.description ?? undefined,
      images: [imageUrl],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
