import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DomusGes — Seguimiento de pacientes",
  description:
    "Aplicación de seguimiento de pacientes para terapia ocupacional, fisioterapia y psicología domiciliaria.",
  keywords: ["DomusGes", "terapia ocupacional", "fisioterapia", "psicología", "seguimiento pacientes"],
  authors: [{ name: "DomusGes" }],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${inter.variable} antialiased bg-background text-foreground`}>
        <Providers>{children}</Providers>
        <Toaster />
      </body>
    </html>
  );
}
