import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EDMS Media",
  description: "Browse documents and analyze images from the EDMS.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans">{children}</body>
    </html>
  );
}