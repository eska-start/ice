import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "동물마을 얼음땡 - 3D 모바일 파티 액션",
  description: "귀여운 동물 친구들과 함께하는 3D 얼음땡 게임. 원본 게임의 캐릭터, 코스튬, 스테이지와 멀티플레이를 즐겨보세요.",
  manifest: "/manifest.json",
  applicationName: "동물마을 얼음땡",
  appleWebApp: {
    capable: true,
    title: "동물마을 얼음땡",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "48x48", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#7cc4f0",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="동물마을 얼음땡" />
        <meta name="theme-color" content="#7cc4f0" />
        <link rel="icon" href="/favicon.png" type="image/png" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="apple-touch-icon-precomposed" href="/icons/apple-touch-icon.png" />
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Jua&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased">
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ("serviceWorker" in navigator) {
                const regSw = () => {
                  navigator.serviceWorker.register("/sw.js", { scope: "/" })
                    .then((reg) => { console.log("[PWA] ServiceWorker registered:", reg.scope); })
                    .catch((err) => { console.warn("[PWA] ServiceWorker registration failed:", err); });
                };
                if (document.readyState === "complete") {
                  regSw();
                } else {
                  window.addEventListener("load", regSw);
                }
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
