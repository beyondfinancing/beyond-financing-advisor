import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Beyond Intelligence",
  description:
    "Beyond Intelligence — AI-powered mortgage decision support supervised by a licensed mortgage professional.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
