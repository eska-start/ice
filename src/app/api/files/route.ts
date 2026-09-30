import { NextResponse } from "next/server";
import { db } from "@/db";
import { files } from "@/db/schema";
import { desc } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const list = await db
      .select()
      .from(files)
      .orderBy(desc(files.createdAt));
    return NextResponse.json({ files: list });
  } catch (err) {
    console.error("List error:", err);
    return NextResponse.json(
      { error: "파일 목록을 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}
