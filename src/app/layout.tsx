import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import { Providers } from "@/components/providers";
import { TabBar } from "@/components/tab-bar";
import "./globals.css";

// The typeface Coy's own site uses.
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
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
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${bricolage.variable} antialiased`}>
      <body className="bg-paper text-ink md:bg-soft min-h-dvh">
        <Providers>
          {/* Mobile-first column: full-screen on phones, a framed "device" on desktop. */}
          <div className="bg-paper md:edge md:hard-lg mx-auto flex h-dvh w-full max-w-[440px] flex-col overflow-hidden md:my-6 md:h-[min(860px,calc(100dvh-3rem))] md:rounded-[32px]">
            <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
            <TabBar />
          </div>
        </Providers>
      </body>
    </html>
  );
}
