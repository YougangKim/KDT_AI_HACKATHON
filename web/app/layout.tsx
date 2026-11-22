import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AlertBell } from "@/components/result/AlertBell";

export const metadata: Metadata = {
  title: "마이뉴스 | 나에게 맞는 청년 공고 소식",
  description: "예·아니오만 답하면 지금 받을 수 있는 청년 주택·지원금·일자리를 맞혀 주고, 새 공고가 뜨면 알려 드려요.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#4f46e5",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="min-h-dvh bg-slate-50 text-slate-900 antialiased">
        <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4">
          <header className="flex justify-end pt-2">
            <AlertBell />
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
