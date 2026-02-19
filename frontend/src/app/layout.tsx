import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "@fontsource/google-sans/400.css";
import "@fontsource/google-sans/500.css";
import "@fontsource/google-sans/600.css";
import "@fontsource/google-sans/700.css";
import "./globals.css";
import { NavBar } from "@/components/nav-bar";
import { Providers } from "./providers";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OptimizeQL",
  description: "AI-powered SQL query analysis and optimization",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistMono.variable} antialiased bg-[#faf8f4] min-h-screen flex`}
      >
        <Providers>
          <NavBar />
          <main className="flex-1 p-8 overflow-auto min-h-screen bg-white">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
