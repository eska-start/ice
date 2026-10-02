"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Download, X, Smartphone, CheckCircle2, Share, MoreVertical, Compass, ExternalLink, Sparkles } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

function subscribeStandalone(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  const mql = window.matchMedia("(display-mode: standalone)");
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getStandaloneSnapshot() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
    document.referrer.includes("android-app://")
  );
}

export function PWAInstaller() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const isStandalone = useSyncExternalStore(subscribeStandalone, getStandaloneSnapshot, () => false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [osType, setOsType] = useState<"ios" | "android" | "other">("other");
  const [isInAppBrowser, setIsInAppBrowser] = useState(false);

  useEffect(() => {
    // 1. Device & In-App Browser Detection
    const ua = navigator.userAgent.toLowerCase();
    const isIOSDevice =
      /iphone|ipad|ipod/.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isAndroidDevice = /android/.test(ua);

    if (isIOSDevice) {
      setOsType("ios");
    } else if (isAndroidDevice) {
      setOsType("android");
    } else {
      setOsType("other");
    }

    // Check if opened inside in-app webview (Kakao, Line, Instagram, FB, Naver, etc.)
    const inApp = /kakaotalk|line|instagram|fbav|fbios|fban|naver|daum|wv/.test(ua);
    setIsInAppBrowser(inApp);

    // 2. Check session dismissal
    const dismissed = sessionStorage.getItem("ice_tag_pwa_dismissed") === "true";
    if (dismissed) {
      setIsDismissed(true);
    }

    // 4. Capture PWA prompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setShowGuideModal(false);
    };

    const handleManualTrigger = () => {
      triggerInstall();
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

  const triggerInstall = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === "accepted") {
          setDeferredPrompt(null);
          setShowGuideModal(false);
          return;
        }
      } catch (err) {
        console.error("Install prompt error:", err);
      }
    }
    // If no direct prompt is available (iOS, in-app browser, or chrome heuristic waiting), show modal
    setShowGuideModal(true);
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    sessionStorage.setItem("ice_tag_pwa_dismissed", "true");
  };

  // If already installed and running as standalone app, don't show any installation UI
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
          <div className="flex items-center gap-3 rounded-2xl border-2 border-white/80 bg-gradient-to-r from-sky-900/95 via-sky-800/95 to-cyan-900/95 p-3 text-white shadow-2xl backdrop-blur-md">
            <div className="relative flex h-13 w-13 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-white/60 bg-sky-500 shadow-md">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/icons/icon-192.png"
                alt="얼음땡 앱 아이콘"
                className="h-full w-full object-cover"
              />
              <span className="absolute -top-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-cyan-500 border border-white items-center justify-center text-[9px] font-black text-white">★</span>
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-sm tracking-tight text-white drop-shadow">
                  동물마을 얼음땡
                </span>
                <span className="rounded-full bg-cyan-400/25 px-1.5 py-0.5 text-[10px] font-bold text-cyan-200 border border-cyan-300/30 flex items-center gap-0.5">
                  <Sparkles size={9} /> 공식 앱
                </span>
              </div>
              <p className="truncate text-xs text-sky-200 mt-0.5">
                홈 화면에 추가하고 전체화면으로 빠르게 즐기세요!
              </p>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={triggerInstall}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 px-3.5 py-2.5 text-xs font-black text-sky-950 shadow-lg shadow-amber-500/30 transition-all active:scale-95 hover:brightness-105"
              >
                <Download size={14} className="stroke-[2.8]" />
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowGuideModal(false)}
        >
          <div
            className="relative w-full max-w-sm rounded-[28px] border-2 border-white/90 bg-gradient-to-b from-sky-50 via-white to-sky-100 p-6 text-slate-800 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="absolute right-4 top-4 rounded-full p-2 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
              aria-label="안내 닫기"
            >
              <X size={18} strokeWidth={2.5} />
            </button>

            {/* App Header Info */}
            <div className="flex items-center gap-3.5 mb-4">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl border-2 border-sky-400 bg-sky-200 shadow-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/icons/icon-192.png"
                  alt="동물마을 얼음땡"
                  className="h-full w-full object-cover"
                />
              </div>
              <div>
                <h3 className="font-extrabold text-lg text-sky-950 leading-tight">
                  동물마을 얼음땡
                </h3>
                <p className="text-xs text-sky-700 font-semibold mt-0.5">
                  웹앱(PWA)으로 홈 화면에 설치
                </p>
                <div className="flex items-center gap-1.5 mt-1 text-[11px] text-emerald-600 font-medium">
                  <CheckCircle2 size={12} /> 브라우저 주소창 없이 전체화면 실행
                </div>
              </div>
            </div>

            {/* In-App Browser Notice */}
            {isInAppBrowser && (
              <div className="mb-4 rounded-2xl bg-amber-50 border-2 border-amber-300 p-3.5 text-xs text-amber-900 shadow-xs">
                <div className="flex items-center gap-1.5 font-bold text-amber-950 mb-1">
                  <ExternalLink size={14} className="text-amber-600" />
                  기본 브라우저로 열어주세요!
                </div>
                <p className="leading-5">
                  현재 <strong>카카오톡/인스타그램 등 인앱 브라우저</strong>에서는 보안 정책상 앱 설치가 제한됩니다.
                </p>
                <p className="mt-1 leading-5 text-amber-800">
                  우측 상단 <strong>더보기(⋮ 또는 ⋯)</strong>를 누르고 <strong>&apos;다른 브라우저로 열기&apos;</strong>(Safari/Chrome)를 선택한 후 설치해 주세요!
                </p>
              </div>
            )}

            {/* Installation Steps */}
            <div className="space-y-2.5 rounded-2xl bg-white/90 p-4 text-xs text-slate-700 shadow-sm border border-sky-100">
              {osType === "ios" ? (
                <>
                  <div className="font-bold text-sky-950 text-sm mb-1 flex items-center gap-1.5">
                    <Smartphone size={16} className="text-sky-600" />
                    아이폰 / 아이패드 (Safari) 설치 방법
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-500 text-[11px] font-bold text-white">
                      1
                    </span>
                    <p className="leading-5">
                      사파리 브라우저 화면 하단의 <strong>공유 버튼(<Share size={13} className="inline text-sky-600 stroke-[2.5]" />)</strong>을 터치합니다.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-500 text-[11px] font-bold text-white">
                      2
                    </span>
                    <p className="leading-5">
                      메뉴를 아래로 내려 <strong>&apos;홈 화면에 추가&apos;</strong> 항목을 선택합니다.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-500 text-[11px] font-bold text-white">
                      3
                    </span>
                    <p className="leading-5">
                      우측 상단 <strong>&apos;추가&apos;</strong> 버튼을 누르면 홈 화면에 게임 앱이 설치됩니다!
                    </p>
                  </div>
                </>
              ) : osType === "android" ? (
                <>
                  <div className="font-bold text-sky-950 text-sm mb-1 flex items-center gap-1.5">
                    <Smartphone size={16} className="text-sky-600" />
                    안드로이드 (Chrome / 삼성 인터넷) 설치
                  </div>
                  {deferredPrompt ? (
                    <div className="mb-2">
                      <button
                        type="button"
                        onClick={triggerInstall}
                        className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-2.5 text-xs font-bold text-white shadow-md transition hover:brightness-105 active:scale-98"
                      >
                        <Download size={14} /> 지금 바로 원클릭 설치
                      </button>
                    </div>
                  ) : null}
                  <div className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-500 text-[11px] font-bold text-white">
                      1
                    </span>
                    <p className="leading-5">
                      브라우저 우측 상단 <strong>메뉴(<MoreVertical size={13} className="inline text-sky-600" />)</strong>를 누릅니다.
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
                      설치 팝업에서 <strong>&apos;설치&apos;</strong>를 누르면 홈 화면에 앱 아이콘이 등록됩니다!
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="font-bold text-sky-950 text-sm mb-1 flex items-center gap-1.5">
                    <Compass size={16} className="text-sky-600" />
                    PC / 기타 브라우저 설치 방법
                  </div>
                  {deferredPrompt ? (
                    <div className="mb-2">
                      <button
                        type="button"
                        onClick={triggerInstall}
                        className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-2.5 text-xs font-bold text-white shadow-md transition hover:brightness-105 active:scale-98"
                      >
                        <Download size={14} /> 컴퓨터에 앱으로 설치
                      </button>
                    </div>
                  ) : (
                    <p className="leading-5">
                      브라우저 주소창 우측의 <strong>설치 아이콘(모니터 또는 다운로드 모양)</strong>을 누르거나, 브라우저 메뉴에서 <strong>&apos;동물마을 얼음땡 설치&apos;</strong>를 선택해 주세요.
                    </p>
                  )}
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 py-3 text-xs font-bold text-white shadow-md transition hover:brightness-105 active:scale-98"
            >
              <CheckCircle2 size={16} />
              확인했어요
            </button>
          </div>
        </div>
      )}
    </>
  );
}
