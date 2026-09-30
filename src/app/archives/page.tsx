"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type FileRecord = {
  id: number;
  originalName: string;
  storedName: string;
  extension: string;
  mimeType: string;
  size: number;
  createdAt: string;
};

const ACCEPT =
  ".zip,.rar,.7z,.tar,.gz,.tgz,.bz2,.tbz2,.xz,.txz,.zst,.lz,.lzma,.alz,.egg,.cab,.iso,.jar,.war,.apk";

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(value >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function extBadgeColor(ext: string): string {
  if (ext.includes("zip")) return "bg-amber-100 text-amber-800";
  if (ext.includes("rar")) return "bg-purple-100 text-purple-800";
  if (ext.includes("7z")) return "bg-emerald-100 text-emerald-800";
  if (ext.includes("tar") || ext.includes("gz") || ext.includes("xz"))
    return "bg-sky-100 text-sky-800";
  return "bg-slate-100 text-slate-700";
}

export default function Home() {
  const [fileList, setFileList] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadFiles = useCallback(async () => {
    try {
      const res = await fetch("/api/files");
      const data = await res.json();
      if (res.ok) setFileList(data.files);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const uploadFiles = useCallback(
    (selected: FileList | File[]) => {
      const arr = Array.from(selected);
      if (arr.length === 0) return;

      setUploading(true);
      setProgress(0);
      setMessage(null);

      const formData = new FormData();
      arr.forEach((f) => formData.append("files", f));

      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/upload");

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          setProgress(Math.round((e.loaded / e.total) * 100));
        }
      };

      xhr.onload = () => {
        setUploading(false);
        try {
          const data = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300) {
            const savedCount = data.saved?.length ?? 0;
            const rejectedCount = data.rejected?.length ?? 0;
            let text = `${savedCount}개 파일 업로드 완료!`;
            if (rejectedCount > 0) {
              text += ` (${rejectedCount}개 실패: ${data.rejected[0].reason})`;
            }
            setMessage({ type: "success", text });
            loadFiles();
          } else {
            setMessage({
              type: "error",
              text: data.error ?? "업로드에 실패했습니다.",
            });
          }
        } catch {
          setMessage({ type: "error", text: "업로드에 실패했습니다." });
        }
      };

      xhr.onerror = () => {
        setUploading(false);
        setMessage({
          type: "error",
          text: "네트워크 오류로 업로드에 실패했습니다.",
        });
      };

      xhr.send(formData);
    },
    [loadFiles]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        uploadFiles(e.dataTransfer.files);
      }
    },
    [uploadFiles]
  );

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/files/${id}`, { method: "DELETE" });
    if (res.ok) {
      setFileList((prev) => prev.filter((f) => f.id !== id));
      setMessage({ type: "success", text: "파일이 삭제되었습니다." });
    } else {
      const data = await res.json().catch(() => null);
      setMessage({
        type: "error",
        text: data?.error ?? "삭제에 실패했습니다.",
      });
    }
  };

  return (
    <main className="archive-page min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <a href="/" className="mb-6 inline-flex items-center rounded-lg bg-white px-4 py-2 text-sm font-semibold text-sky-700 shadow-sm hover:bg-sky-50">
          ← 동물마을 얼음땡으로 돌아가기
        </a>
        <header className="mb-8 text-center">
          <div className="mb-3 text-5xl">🗜️</div>
          <h1 className="text-3xl font-bold text-slate-900">
            압축파일 업로드
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            ZIP, RAR, 7Z, TAR.GZ, ALZ, EGG 등 압축파일을 업로드하세요 (최대
            500MB)
          </p>
        </header>

        {/* 드롭존 */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !uploading && inputRef.current?.click()}
          className={`cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-all ${
            dragOver
              ? "border-blue-500 bg-blue-50 scale-[1.01]"
              : "border-slate-300 bg-white hover:border-blue-400 hover:bg-slate-50"
          } ${uploading ? "pointer-events-none opacity-70" : ""}`}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => {
              if (e.target.files) uploadFiles(e.target.files);
              e.target.value = "";
            }}
          />
          {uploading ? (
            <div>
              <p className="mb-3 font-medium text-slate-700">
                업로드 중... {progress}%
              </p>
              <div className="mx-auto h-2.5 w-full max-w-sm overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-3 text-4xl">📦</div>
              <p className="font-medium text-slate-700">
                압축파일을 여기에 끌어다 놓거나 클릭해서 선택하세요
              </p>
              <p className="mt-1.5 text-xs text-slate-400">
                지원 형식: zip · rar · 7z · tar · gz · bz2 · xz · alz · egg ·
                iso · jar 등
              </p>
            </div>
          )}
        </div>

        {/* 메시지 */}
        {message && (
          <div
            className={`mt-4 rounded-lg px-4 py-3 text-sm font-medium ${
              message.type === "success"
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-red-50 text-red-700 border border-red-200"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* 파일 목록 */}
        <section className="mt-8">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-slate-800">
            업로드된 파일
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
              {fileList.length}
            </span>
          </h2>

          {loading ? (
            <div className="rounded-xl bg-white p-8 text-center text-sm text-slate-400 shadow-sm">
              불러오는 중...
            </div>
          ) : fileList.length === 0 ? (
            <div className="rounded-xl bg-white p-8 text-center text-sm text-slate-400 shadow-sm">
              아직 업로드된 파일이 없습니다.
            </div>
          ) : (
            <ul className="space-y-2">
              {fileList.map((file) => (
                <li
                  key={file.id}
                  className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                >
                  <span
                    className={`shrink-0 rounded-md px-2 py-1 text-xs font-bold uppercase ${extBadgeColor(
                      file.extension
                    )}`}
                  >
                    {file.extension.replace(/^\./, "")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-sm font-medium text-slate-800"
                      title={file.originalName}
                    >
                      {file.originalName}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {formatBytes(file.size)} · {formatDate(file.createdAt)}
                    </p>
                  </div>
                  <a
                    href={`/api/files/${file.id}/download`}
                    className="shrink-0 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-100"
                  >
                    다운로드
                  </a>
                  <button
                    onClick={() => handleDelete(file.id)}
                    className="shrink-0 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-100"
                  >
                    삭제
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
