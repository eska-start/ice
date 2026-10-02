"use client";

import { useEffect, useState } from "react";
import { Download, X, Smartphone, CheckCircle2, Share2, MoreVertical } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function PWAInstaller() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    // Check standalone mode (already installed as PWA)
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
        document.referrer.includes("android-app://");
      setIsStandalone(isStandaloneMode);
    };

    checkStandalone();

    // Check device type
    const ua = navigator.userAgent.toLowerCase();
    const android = /android/.test(ua);
    setIsAndroid(android);

    // Check session dismissal
    const dismissed = sessionStorage.getItem("ice_tag_pwa_dismissed") === "true";
    if (dismissed) {
      setIsDismissed(true);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
      setShowGuideModal(false);
    };

    const handleManualTrigger = () => {
      setShowGuideModal(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    window.addEventListener("trigger-pwa-install", handleManualTrigger);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      window.removeEventListener("trigger-pwa-install", handleManualTrigger);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === "accepted") {
          setDeferredPrompt(null);
        }
      } catch (err) {
        console.error("Install prompt error:", err);
      }
    } else {
      // If prompt event is not available, show guide modal
      setShowGuideModal(true);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    sessionStorage.setItem("ice_tag_pwa_dismissed", "true");
  };

  // If already running in standalone app mode, don't show prompt banner
  if (isStandalone) {
    return null;
  }

  return (
    <>
      {/* Floating Bottom Banner for Easy Installation */}
      {!isDismissed && (
        <aside
          role="complementary"
          aria-label="앱 설치 안내"
          className="fixed bottom-3 left-3 right-3 z-50 mx-auto max-w-md animate-fade-in-up"
        >
          <div className="flex items-center gap-3 rounded-2xl border-2 border-white/90 bg-sky-900/90 p-3 text-white shadow-2xl backdrop-blur-md">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/40 bg-sky-500 shadow-md">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/icons/icon-192.png"
                alt="얼음땡 앱 아이콘"
                className="h-full w-full object-cover"
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm tracking-tight text-white drop-shadow">
                  동물마을 얼음땡
                </span>
                <span className="rounded-full bg-emerald-400/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                  앱으로 추가
                </span>
              </div>
              <p className="truncate text-xs text-sky-200">
                홈 화면에 추가하고 전체화면으로 빠르게 즐기세요!
              </p>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleInstallClick}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-3 py-2 text-xs font-bold text-sky-950 shadow-md transition-all active:scale-95 hover:brightness-105"
              >
                <Download size={14} className="stroke-[2.5]" />
                설치
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                aria-label="닫기"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* Manual Installation Guide Modal */}
      {showGuideModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
        >
          <div className="relative w-full max-w-sm rounded-3xl border-2 border-white/80 bg-gradient-to-b from-sky-100 to-sky-50 p-6 text-slate-800 shadow-2xl">
            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="absolute right-4 top-4 rounded-full p-1.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
              aria-label="안내 닫기"
            >
              <X size={20} />
            </button>

            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-500 text-white shadow-lg">
              <Smartphone size={28} />
            </div>

            <h3 className="text-center font-bold text-lg text-sky-950">
              {isAndroid ? "안드로이드 앱으로 추가하기" : "홈 화면에 앱으로 추가"}
            </h3>

            <p className="mt-1 text-center text-xs text-slate-600">
              홈 화면에 추가하면 앱처럼 전체화면으로 실행됩니다.
            </p>

            <div className="mt-4 space-y-3 rounded-2xl bg-white/80 p-4 text-xs text-slate-700 shadow-xs border border-sky-100">
              {isAndroid ? (
                <>
                  <div className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-500 text-[11px] font-bold text-white">
                      1
                    </span>
                    <p className="leading-5">
                      브라우저 우측 상단의 <strong>메뉴 버튼(<MoreVertical size={12} className="inline" />)</strong>을 터치합니다.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-500 text-[11px] font-bold text-white">
                      2
                    </span>
                    <p className="leading-5">
                      <strong>&apos;앱 설치&apos;</strong> 또는 <strong>&apos;홈 화면에 추가&apos;</strong>를 선택합니다.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-500 text-[11px] font-bold text-white">
                      3
                    </span>
                    <p className="leading-5">
                      팝업에서 <strong>&apos;설치&apos;</strong>를 누르면 홈 화면에 앱 아이콘이 생성됩니다!
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-500 text-[11px] font-bold text-white">
                      1
                    </span>
                    <p className="leading-5">
                      브라우저 하단의 <strong>공유 버튼(<Share2 size={12} className="inline" />)</strong>을 누릅니다.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-500 text-[11px] font-bold text-white">
                      2
                    </span>
                    <p className="leading-5">
                      메뉴를 내려 <strong>&apos;홈 화면에 추가&apos;</strong>를 터치합니다.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-500 text-[11px] font-bold text-white">
                      3
                    </span>
                    <p className="leading-5">
                      우측 상단 <strong>&apos;추가&apos;</strong>를 누르면 완료됩니다!
                    </p>
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl bg-sky-600 py-2.5 text-xs font-bold text-white shadow-md transition hover:bg-sky-700 active:scale-98"
            >
              <CheckCircle2 size={15} />
              확인했어요
            </button>
          </div>
        </div>
      )}
    </>
  );
}
