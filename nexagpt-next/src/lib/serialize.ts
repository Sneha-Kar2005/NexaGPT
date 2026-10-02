import type { ThreadDoc } from "@/models/Thread";
import type { ChatMessage, ImageResult, ThreadDetail, ThreadSummary } from "./types";

type LeanThread = ThreadDoc & { _id: string; createdAt: Date; updatedAt: Date };

export function toSummary(t: Pick<LeanThread, "_id" | "title" | "updatedAt">): ThreadSummary {
  return { id: t._id, title: t.title, updatedAt: new Date(t.updatedAt).toISOString() };
}

export function toDetail(t: LeanThread): ThreadDetail {
  return {
    ...toSummary(t),
    createdAt: new Date(t.createdAt).toISOString(),
    messages: t.messages.map(
      (m): ChatMessage => ({
        id: m.id,
        role: m.role as ChatMessage["role"],
        content: m.content ?? "",
        createdAt: new Date(m.createdAt ?? Date.now()).toISOString(),
        ...(m.images?.length ? { images: m.images as ImageResult[] } : {}),
      }),
    ),
  };
}
