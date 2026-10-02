import type { NextRequest } from "next/server";
import { Thread } from "@/models/Thread";
import { ensureDB, isNonEmptyString, jsonError, requireUser } from "@/lib/api";
import { describeError, generateTitle, streamReply } from "@/lib/gemini";
import type { ChatMessage, ChatRequest, ChatStreamEvent, ImageResult } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_MESSAGE_LENGTH = 32_000;

function initialTitle(text: string): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > 50 ? `${oneLine.slice(0, 50)}…` : oneLine;
}

/**
 * Sends a message (or edits / regenerates one) and streams the assistant reply
 * back as newline-delimited JSON events (see ChatStreamEvent).
 */
export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const body = (await req.json().catch(() => null)) as ChatRequest | null;
  if (!body || !isNonEmptyString(body.threadId, 100) || !isNonEmptyString(body.assistantMessageId, 100)) {
    return jsonError("Invalid request", 400);
  }
  if (body.action === "send" || body.action === "edit") {
    if (!isNonEmptyString(body.content, MAX_MESSAGE_LENGTH)) {
      return jsonError(`Message must be between 1 and ${MAX_MESSAGE_LENGTH} characters`, 400);
    }
    if (!isNonEmptyString(body.userMessageId, 100)) return jsonError("Invalid request", 400);
  }

  const dbError = await ensureDB();
  if (dbError) return dbError;

  let thread = await Thread.findOne({ _id: body.threadId, userId: auth.userId });
  let isNewThread = false;
  const now = new Date();

  switch (body.action) {
    case "send": {
      if (!thread) {
        // The id may already be taken by another user's chat.
        if (await Thread.exists({ _id: body.threadId })) return jsonError("Chat not found", 404);
        isNewThread = true;
        thread = new Thread({ _id: body.threadId, userId: auth.userId, title: initialTitle(body.content), messages: [] });
      }
      thread.messages.push({ id: body.userMessageId, role: "user", content: body.content, createdAt: now });
      break;
    }
    case "edit": {
      if (!thread) return jsonError("Chat not found", 404);
      const idx = thread.messages.findIndex((m) => m.id === body.userMessageId && m.role === "user");
      if (idx === -1) return jsonError("Message not found", 404);
      const kept = thread.messages.slice(0, idx).map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
        ...(m.images?.length ? { images: m.images } : {}),
      }));
      kept.push({ id: body.userMessageId, role: "user", content: body.content, createdAt: now });
      thread.set("messages", kept);
      break;
    }
    case "regenerate": {
      if (!thread) return jsonError("Chat not found", 404);
      if (thread.messages.at(-1)?.role === "assistant") thread.messages.pop();
      if (thread.messages.at(-1)?.role !== "user") return jsonError("Nothing to regenerate", 400);
      break;
    }
    default:
      return jsonError("Unknown action", 400);
  }

  // Persist the user's side of the conversation before calling the model.
  thread.markModified("messages");
  await thread.save();

  const threadId = thread._id;
  const history = thread.messages.map((m) => ({
    role: m.role as ChatMessage["role"],
    content: m.content ?? "",
    images: m.images as ImageResult[] | undefined,
  }));
  const firstUserMessage = isNewThread && body.action === "send" ? body.content : null;
  const assistantMessageId = body.assistantMessageId;
  const abort = new AbortController();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (event: ChatStreamEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        } catch {
          closed = true;
        }
      };

      // Title generation runs in parallel with the reply.
      const titlePromise = firstUserMessage ? generateTitle(firstUserMessage) : null;
      let full = "";
      const images: ImageResult[] = [];
      let errorMessage: string | null = null;

      try {
        for await (const event of streamReply(history, abort.signal)) {
          if (event.type === "text") {
            full += event.text;
            send({ type: "delta", text: event.text });
          } else if (event.type === "images") {
            images.push(...event.images);
            send(event);
          } else {
            send(event);
          }
        }
        if (!full.trim() && !images.length && !abort.signal.aborted) {
          errorMessage = "The model returned an empty response. Please try again.";
        }
      } catch (err) {
        if (!abort.signal.aborted) {
          console.error("Gemini error:", err);
          errorMessage = describeError(err);
        }
      }

      // Save whatever was generated, including partial output if the user pressed stop.
      try {
        if (full.trim() || images.length) {
          await Thread.updateOne(
            { _id: threadId },
            {
              $push: {
                messages: {
                  id: assistantMessageId,
                  role: "assistant",
                  content: full,
                  createdAt: new Date(),
                  ...(images.length ? { images } : {}),
                },
              },
            },
          );
        }
        if (titlePromise) {
          const title = await titlePromise;
          if (title) {
            await Thread.updateOne({ _id: threadId }, { title }, { timestamps: false });
            send({ type: "title", title });
          }
        }
      } catch (err) {
        console.error("Failed to save reply:", err);
        errorMessage ??= "Failed to save the response to the database.";
      }

      if (errorMessage) send({ type: "error", message: errorMessage });
      send({ type: "done" });
      if (!closed) {
        closed = true;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
    cancel() {
      // Client disconnected or pressed "Stop generating".
      abort.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
