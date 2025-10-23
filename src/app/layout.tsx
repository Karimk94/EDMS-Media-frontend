import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EDMS Viewer",
  description: "Browse documents and analyze images from the EDMS.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-gray-50 font-sans">{children}</body>
    </html>
  );
}
