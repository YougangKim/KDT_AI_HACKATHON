import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AlertBell } from "@/components/result/AlertBell";
import { AlertPolling } from "@/components/AlertPolling";

export const metadata: Metadata = {
  title: "My News | 나만의 소식통",
  description: "질문에 답하면 나에게 맞는 주택·지원금·일자리 공고를 찾고, 새로운 소식을 알립니다.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#4f46e5",
  colorScheme: "only light", // 휴대폰·브라우저의 강제 다크 모드에서도 밝게
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
        <div className="app-shell mx-auto flex min-h-dvh max-w-md flex-col px-4">
          <AlertPolling />
          <header className="flex justify-end pt-2">
            <AlertBell />
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
