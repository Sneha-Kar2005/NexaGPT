import { NextResponse } from "next/server";
import { Thread } from "@/models/Thread";
import { ensureDB, jsonError, requireUser } from "@/lib/api";
import { toSummary } from "@/lib/serialize";

export const dynamic = "force-dynamic";

/** List the user's conversations, most recently updated first. */
export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const dbError = await ensureDB();
  if (dbError) return dbError;
  try {
    const threads = await Thread.find({ userId: auth.userId }, { title: 1, updatedAt: 1 }).sort({ updatedAt: -1 }).lean();
    return NextResponse.json(threads.map((t) => toSummary(t as never)));
  } catch (err) {
    console.error(err);
    return jsonError("Failed to load chats", 500);
  }
}

/** Delete all of the user's conversations. */
export async function DELETE() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const dbError = await ensureDB();
  if (dbError) return dbError;
  try {
    const { deletedCount } = await Thread.deleteMany({ userId: auth.userId });
    return NextResponse.json({ deleted: deletedCount });
  } catch (err) {
    console.error(err);
    return jsonError("Failed to delete chats", 500);
  }
}
