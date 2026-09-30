import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { files } from "@/db/schema";
import {
  getArchiveExtension,
  MAX_FILE_SIZE,
  UPLOAD_DIR,
  formatBytes,
} from "@/lib/archive";
import { mkdir, writeFile } from "fs/promises";
import { randomUUID } from "crypto";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const entries = formData.getAll("files");

    const uploadFiles = entries.filter(
      (entry): entry is File => entry instanceof File
    );

    if (uploadFiles.length === 0) {
      return NextResponse.json(
        { error: "업로드할 파일이 없습니다." },
        { status: 400 }
      );
    }

    await mkdir(UPLOAD_DIR, { recursive: true });

    const saved = [];
    const rejected: { name: string; reason: string }[] = [];

    for (const file of uploadFiles) {
      const ext = getArchiveExtension(file.name);

      if (!ext) {
        rejected.push({
          name: file.name,
          reason: "지원하지 않는 파일 형식입니다. (압축파일만 업로드 가능)",
        });
        continue;
      }

      if (file.size > MAX_FILE_SIZE) {
        rejected.push({
          name: file.name,
          reason: `파일 크기가 너무 큽니다. (최대 ${formatBytes(MAX_FILE_SIZE)})`,
        });
        continue;
      }

      if (file.size === 0) {
        rejected.push({ name: file.name, reason: "빈 파일입니다." });
        continue;
      }

      const storedName = `${randomUUID()}${ext}`;
      const filePath = path.join(UPLOAD_DIR, storedName);

      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(filePath, buffer);

      const [record] = await db
        .insert(files)
        .values({
          originalName: file.name,
          storedName,
          extension: ext,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
        })
        .returning();

      saved.push(record);
    }

    if (saved.length === 0) {
      return NextResponse.json(
        {
          error: rejected[0]?.reason ?? "업로드에 실패했습니다.",
          rejected,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ saved, rejected });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { error: "서버 오류로 업로드에 실패했습니다." },
      { status: 500 }
    );
  }
}
