/* eslint-disable @next/next/no-page-custom-font -- The App Router root layout loads these fonts across every route. */
import type { Metadata } from "next";
import "./globals.css";
import { Platform } from "@/components/Platform";

export const metadata: Metadata = {
  title: "Addis Psychology Platform",
  description: "Your safe space to find compassionate mental health support. Connect with expert psychotherapists, counselors, and clinical psychologists.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Ethiopic:wght@400;500;600;700;800;900&family=Archivo+Black&family=Work+Sans:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body className="rawblock min-h-screen">
        <Platform>{children}</Platform>
      </body>
    </html>
  );
}


