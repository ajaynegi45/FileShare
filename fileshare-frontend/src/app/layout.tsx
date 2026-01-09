import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Suspense } from "react";
import Image from "next/image";
import { Toaster } from 'sonner'
import FileShareIcon from "@/assest/FileShareIcon.svg"


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FileShare | Secure P2P File Transfer" ,
  description: "Secure P2P File Transfer",
  icons: {icon: FileShareIcon.src},
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
    <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>

    <Suspense fallback={
        <div role="status" aria-live="polite" className="fixed inset-0 flex items-center justify-center bg-background z-50">
            <Image
                src={FileShareIcon.src}
                alt="Loading..."
                width={120}
                height={120}
                priority
                fetchPriority={"high"}
            />
        </div>}>
      <Toaster richColors  position="bottom-right" />
      {children}
    </Suspense>
    </body>
    </html>
  );
}
