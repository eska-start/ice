import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { files } from "@/db/schema";
import { eq } from "drizzle-orm";
import { unlink } from "fs/promises";
import { UPLOAD_DIR } from "@/lib/archive";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
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

    await db.delete(files).where(eq(files.id, fileId));

    try {
      await unlink(path.join(UPLOAD_DIR, record.storedName));
    } catch {
      // 디스크에 파일이 없어도 DB 삭제는 성공으로 처리
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Delete error:", err);
    return NextResponse.json(
      { error: "삭제에 실패했습니다." },
      { status: 500 }
    );
  }
}
