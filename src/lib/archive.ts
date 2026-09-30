import path from "path";

// 지원하는 압축파일 확장자 목록
export const ALLOWED_ARCHIVE_EXTENSIONS = [
  ".zip",
  ".rar",
  ".7z",
  ".tar",
  ".gz",
  ".tgz",
  ".tar.gz",
  ".bz2",
  ".tbz2",
  ".tar.bz2",
  ".xz",
  ".txz",
  ".tar.xz",
  ".zst",
  ".lz",
  ".lzma",
  ".alz",
  ".egg",
  ".cab",
  ".iso",
  ".jar",
  ".war",
  ".apk",
] as const;

// 최대 업로드 크기: 500MB
export const MAX_FILE_SIZE = 500 * 1024 * 1024;

export const UPLOAD_DIR = path.join(process.cwd(), "uploads");

/**
 * 파일명에서 압축 확장자를 추출한다.
 * ".tar.gz" 같은 이중 확장자를 우선적으로 인식한다.
 */
export function getArchiveExtension(fileName: string): string | null {
  const lower = fileName.toLowerCase();

  const doubleExts = [".tar.gz", ".tar.bz2", ".tar.xz"];
  for (const ext of doubleExts) {
    if (lower.endsWith(ext)) return ext;
  }

  const ext = path.extname(lower);
  if (
    ext &&
    (ALLOWED_ARCHIVE_EXTENSIONS as readonly string[]).includes(ext)
  ) {
    return ext;
  }
  return null;
}

export function isArchiveFile(fileName: string): boolean {
  return getArchiveExtension(fileName) !== null;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(value >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}
