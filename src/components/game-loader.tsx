"use client";

import dynamic from "next/dynamic";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { LoaderCircle, Snowflake } from "lucide-react";

function LoadingGame() {
  return (
    <main className="fixed inset-0 flex items-center justify-center bg-gradient-to-b from-sky-200 via-sky-100 to-emerald-100 px-6 text-center">
      <div role="status" aria-live="polite">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl border-4 border-white bg-sky-500 text-white shadow-xl shadow-sky-700/15">
          <Snowflake size={42} strokeWidth={2.5} aria-hidden="true" />
        </div>
        <p className="font-display text-xl text-sky-800">동물마을</p>
        <h1 className="font-display mt-1 text-5xl text-sky-900">얼음땡</h1>
        <p className="mt-7 flex items-center justify-center gap-2 text-sm font-semibold text-sky-800/80">
          <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />
          동물 친구들을 불러오는 중…
        </p>
      </div>
    </main>
  );
}

const GameApp = dynamic(() => import("@/features/ice-tag/App"), {
  ssr: false,
  loading: LoadingGame,
});

class GameErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Ice tag game failed to load:", error, info);
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="fixed inset-0 flex items-center justify-center bg-sky-100 p-6 text-center">
          <div className="max-w-sm rounded-3xl border border-white bg-white/80 p-8 shadow-xl">
            <Snowflake className="mx-auto mb-4 text-sky-500" size={40} />
            <h1 className="font-display text-2xl text-sky-900">게임을 불러오지 못했어요</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              최신 브라우저에서 다시 시도해주세요. 3D 게임 실행에는 WebGL 2 지원이 필요합니다.
            </p>
            <button
              className="mt-6 rounded-2xl bg-sky-600 px-6 py-3 font-bold text-white transition hover:bg-sky-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-600"
              onClick={() => window.location.reload()}
            >
              다시 불러오기
            </button>
            <a href="/archives" className="mt-4 block text-sm text-sky-700 underline">
              업로드된 압축파일 확인
            </a>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}

export default function GameLoader() {
  return (
    <GameErrorBoundary>
      <GameApp />
    </GameErrorBoundary>
  );
}
