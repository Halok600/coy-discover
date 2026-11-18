import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { Providers } from "@/components/providers";
import { TabBar } from "@/components/tab-bar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Coy Discover", template: "%s · Coy Discover" },
  description:
    "Swipe through profiles and match only when you both like each other. Nobody ever finds out who liked them first.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fdf3f1" },
    { media: "(prefers-color-scheme: dark)", color: "#120d17" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} antialiased`}>
      <body className="bg-bg text-ink min-h-dvh">
        <Providers>
          {/* Mobile-first column: full-screen on phones, a centered "device" on desktop. */}
          <div className="bg-bg md:border-line mx-auto flex h-dvh w-full max-w-[440px] flex-col overflow-hidden md:my-6 md:h-[min(860px,calc(100dvh-3rem))] md:rounded-[2rem] md:border md:shadow-2xl">
            <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
            <TabBar />
          </div>
        </Providers>
      </body>
    </html>
  );
}
