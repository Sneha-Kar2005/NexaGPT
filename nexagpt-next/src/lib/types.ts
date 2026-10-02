export type Role = "user" | "assistant";

/** A real photo found by the image search tool. */
export interface ImageResult {
  thumbUrl: string;
  fullUrl: string;
  /** Page with the full-resolution file, author and license details. */
  sourceUrl: string;
  title: string;
  author?: string;
  license?: string;
  width: number;
  height: number;
}

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  createdAt: string;
  images?: ImageResult[];
}

export interface ThreadSummary {
  id: string;
  title: string;
  updatedAt: string;
}

export interface ThreadDetail extends ThreadSummary {
  createdAt: string;
  messages: ChatMessage[];
}

/** Body accepted by POST /api/chat */
export type ChatRequest =
  | {
      action: "send";
      threadId: string;
      content: string;
      userMessageId: string;
      assistantMessageId: string;
    }
  | {
      action: "edit";
      threadId: string;
      content: string;
      /** id of the user message being edited; everything after it is discarded */
      userMessageId: string;
      assistantMessageId: string;
    }
  | {
      action: "regenerate";
      threadId: string;
      assistantMessageId: string;
    };

/** Newline-delimited JSON events streamed back by POST /api/chat */
export type ChatStreamEvent =
  | { type: "delta"; text: string }
  | { type: "status"; text: string }
  | { type: "images"; images: ImageResult[] }
  | { type: "title"; title: string }
  | { type: "error"; message: string }
  | { type: "done" };
