import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { files } from "@/db/schema";
import { eq } from "drizzle-orm";
import { stat } from "fs/promises";
import { createReadStream } from "fs";
import { Readable } from "stream";
import { UPLOAD_DIR } from "@/lib/archive";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const fileId = Number(id);
    if (!Number.isInteger(fileId)) {
      return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
    }

    const [record] = await db
      .select()
      .from(files)
      .where(eq(files.id, fileId))
      .limit(1);

    if (!record) {
      return NextResponse.json(
        { error: "파일을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const filePath = path.join(UPLOAD_DIR, record.storedName);

    let fileSize: number;
    try {
      const info = await stat(filePath);
      fileSize = info.size;
    } catch {
      return NextResponse.json(
        { error: "저장된 파일이 존재하지 않습니다." },
        { status: 404 }
      );
    }

    const nodeStream = createReadStream(filePath);
    const webStream = Readable.toWeb(nodeStream) as ReadableStream;

    // 한글 파일명 지원 (RFC 5987)
    const encodedName = encodeURIComponent(record.originalName).replace(
      /'/g,
      "%27"
    );

    return new NextResponse(webStream, {
      headers: {
        "Content-Type": record.mimeType || "application/octet-stream",
        "Content-Length": String(fileSize),
        "Content-Disposition": `attachment; filename*=UTF-8''${encodedName}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("Download error:", err);
    return NextResponse.json(
      { error: "다운로드에 실패했습니다." },
      { status: 500 }
    );
  }
}
