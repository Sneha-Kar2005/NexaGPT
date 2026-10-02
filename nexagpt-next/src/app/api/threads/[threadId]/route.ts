import { NextResponse, type NextRequest } from "next/server";
import { Thread } from "@/models/Thread";
import { ensureDB, isNonEmptyString, jsonError, requireUser } from "@/lib/api";
import { toDetail, toSummary } from "@/lib/serialize";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ threadId: string }> };

/** Get a conversation with all its messages. */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { threadId } = await params;
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const dbError = await ensureDB();
  if (dbError) return dbError;
  try {
    const thread = await Thread.findOne({ _id: threadId, userId: auth.userId }).lean();
    if (!thread) return jsonError("Chat not found", 404);
    return NextResponse.json(toDetail(thread as never));
  } catch (err) {
    console.error(err);
    return jsonError("Failed to load chat", 500);
  }
}

/** Rename a conversation. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { threadId } = await params;
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const body = (await req.json().catch(() => null)) as { title?: unknown } | null;
  const title = body?.title;
  if (!isNonEmptyString(title, 200)) return jsonError("A non-empty title is required", 400);

  const dbError = await ensureDB();
  if (dbError) return dbError;
  try {
    const thread = await Thread.findOneAndUpdate(
      { _id: threadId, userId: auth.userId },
      { title: title.trim() },
      { new: true, timestamps: false, projection: { title: 1, updatedAt: 1 } },
    ).lean();
    if (!thread) return jsonError("Chat not found", 404);
    return NextResponse.json(toSummary(thread as never));
  } catch (err) {
    console.error(err);
    return jsonError("Failed to rename chat", 500);
  }
}

/** Delete a conversation. */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { threadId } = await params;
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const dbError = await ensureDB();
  if (dbError) return dbError;
  try {
    const deleted = await Thread.findOneAndDelete({ _id: threadId, userId: auth.userId }).lean();
    if (!deleted) return jsonError("Chat not found", 404);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return jsonError("Failed to delete chat", 500);
  }
}
