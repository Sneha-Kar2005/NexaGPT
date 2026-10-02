import { GoogleGenAI, Type, type Content, type FunctionCall, type Part, type Tool } from "@google/genai";
import { searchImages } from "./images";
import type { ChatMessage, ImageResult } from "./types";
import { DEFAULT_MODEL } from "./utils";

export const MODEL = process.env.GEMINI_MODEL || DEFAULT_MODEL;

/** Max number of prior messages sent to the model as context. */
const MAX_HISTORY = 60;

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your-gemini-api-key") {
    throw new Error("GEMINI_API_KEY is not set. Add it to .env.local and restart the dev server.");
  }
  client ??= new GoogleGenAI({ apiKey });
  return client;
}

function systemInstruction(): string {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return [
    "You are NexaGPT, a helpful, knowledgeable and friendly AI assistant.",
    `Today's date is ${today}.`,
    "Answer clearly and accurately. Use GitHub-flavored Markdown for formatting: headings, lists, tables",
    "and fenced code blocks with a language tag. Keep answers concise unless the user asks for detail.",
    "If you are unsure about something, say so instead of making it up.",
    "You CAN show real photos: call the search_images tool whenever the user asks to see, show or get",
    "pictures, photos or images of something, or when a photo would clearly help (e.g. 'what does a",
    "quokka look like?'). The photos are displayed to the user automatically above your reply, so never",
    "say you cannot show images, and never write image URLs or Markdown image syntax yourself. After the",
    "search, add a short helpful description. You cannot create brand-new artwork; if asked to draw or",
    "generate an image, say so briefly and show real photos of the subject instead.",
  ].join(" ");
}

const tools: Tool[] = [
  {
    functionDeclarations: [
      {
        name: "search_images",
        description:
          "Search for real, freely licensed photos (Wikimedia Commons) and display them to the user.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            query: {
              type: Type.STRING,
              description:
                "1-3 English words naming just the subject, e.g. 'sunflower', 'Eiffel Tower', 'red rose'. " +
                "No adjectives about lighting, style or quality.",
            },
            count: { type: Type.INTEGER, description: "Number of photos to show, 1-8. Default 4." },
          },
          required: ["query"],
        },
      },
    ],
  },
];

type HistoryMessage = Pick<ChatMessage, "role" | "content" | "images">;

function messageText(m: HistoryMessage): string {
  // Tell the model which photos it already showed, since they aren't part of the text.
  if (m.role === "assistant" && m.images?.length) {
    const titles = m.images.map((i) => i.title).join("; ");
    return `[Photos shown to the user: ${titles}]

${m.content}`;
  }
  return m.content;
}

function toContents(messages: HistoryMessage[]): Content[] {
  const contents: Content[] = [];
  for (const m of messages.slice(-MAX_HISTORY)) {
    const text = messageText(m);
    if (!text.trim()) continue;
    const role = m.role === "assistant" ? "model" : "user";
    const prev = contents.at(-1);
    // Merge consecutive turns from the same role (e.g. after a failed reply).
    if (prev?.role === role) prev.parts!.push({ text });
    else contents.push({ role, parts: [{ text }] });
  }
  // The conversation sent to Gemini must start with a user turn.
  while (contents[0]?.role === "model") contents.shift();
  return contents;
}

export type ReplyEvent =
  | { type: "text"; text: string }
  | { type: "status"; text: string }
  | { type: "images"; images: ImageResult[] };

const MAX_TOOL_ROUNDS = 3;

/**
 * Streams the assistant reply for the given conversation. Runs Gemini's tool
 * calls (image search) in between and yields text, status and image events.
 */
export async function* streamReply(messages: HistoryMessage[], signal?: AbortSignal): AsyncGenerator<ReplyEvent> {
  const contents = toContents(messages);

  for (let round = 0; ; round++) {
    const allowTools = round < MAX_TOOL_ROUNDS;
    const stream = await getClient().models.generateContentStream({
      model: MODEL,
      contents,
      config: {
        systemInstruction: systemInstruction(),
        temperature: 0.7,
        abortSignal: signal,
        ...(allowTools ? { tools } : {}),
      },
    });

    // Keep every part (incl. thought signatures) so the model sees its own turn on the next round.
    const parts: Part[] = [];
    const calls: FunctionCall[] = [];
    for await (const chunk of stream) {
      for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
        parts.push(part);
        if (part.functionCall) calls.push(part.functionCall);
        else if (part.text && !part.thought) yield { type: "text", text: part.text };
      }
    }
    if (!calls.length || !allowTools) return;

    const responses: Part[] = [];
    for (const call of calls) {
      if (call.name === "search_images") {
        yield { type: "status", text: `Searching for images of “${String(call.args?.query ?? "").trim()}”…` };
      }
      const { response, images } = await runTool(call, signal);
      if (images?.length) yield { type: "images", images };
      responses.push({ functionResponse: { id: call.id, name: call.name, response } });
    }
    contents.push({ role: "model", parts }, { role: "user", parts: responses });
  }
}

async function runTool(
  call: FunctionCall,
  signal: AbortSignal | undefined,
): Promise<{ response: Record<string, unknown>; images?: ImageResult[] }> {
  if (call.name !== "search_images") return { response: { error: `Unknown tool ${call.name}` } };
  const query = String(call.args?.query ?? "").trim();
  const count = Number(call.args?.count ?? 4) || 4;
  if (!query) return { response: { error: "Missing query" } };
  try {
    const images = await searchImages(query, count, signal);
    if (!images.length) return { response: { result: `No photos found for "${query}". Tell the user.` } };
    return {
      images,
      response: {
        result:
          `Showing ${images.length} photos from Wikimedia Commons to the user. Their titles are listed in ` +
          "'photos'. Describe them based on these titles only. If they don't actually match what the user " +
          "asked for, say honestly that these are the closest photos available.",
        photos: images.map((i) => i.title),
      },
    };
  } catch (err) {
    if (signal?.aborted) throw err;
    console.error("Image search failed:", err);
    return { response: { error: "Image search is unavailable right now. Apologize briefly and answer in text." } };
  }
}

/** Generates a short title for a conversation from its first exchange. */
export async function generateTitle(userMessage: string): Promise<string | null> {
  try {
    const res = await getClient().models.generateContent({
      model: MODEL,
      contents: [
        {
          role: "user",
          parts: [
            {
              text:
                "Write a short title (max 6 words) summarizing this chat request. " +
                "Reply with the title only — no quotes, no trailing punctuation.\n\n" +
                userMessage.slice(0, 2000),
            },
          ],
        },
      ],
      config: { temperature: 0.3, maxOutputTokens: 30 },
    });
    const title = res.text?.trim().replace(/^["'#*\s]+|["'.*\s]+$/g, "");
    return title ? title.slice(0, 80) : null;
  } catch (err) {
    console.error("Title generation failed:", err);
    return null;
  }
}

/** Turns SDK errors into a user-friendly message. */
export function describeError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/GEMINI_API_KEY/.test(msg)) return msg;
  if (/API key not valid|API_KEY_INVALID|PERMISSION_DENIED/i.test(msg)) {
    return "The Gemini API key is invalid. Check GEMINI_API_KEY in .env.local.";
  }
  if (/NOT_FOUND|no longer available|is not found/i.test(msg)) {
    return `The model "${MODEL}" is not available for your API key. Set GEMINI_MODEL in .env.local (e.g. gemini-3.5-flash-lite) and restart the server.`;
  }
  if (/429|RESOURCE_EXHAUSTED|quota/i.test(msg)) {
    return "Rate limit reached for the Gemini API. Please wait a moment and try again.";
  }
  if (/fetch failed|ENOTFOUND|ECONNREFUSED|network/i.test(msg)) {
    return "Could not reach the Gemini API. Check your internet connection.";
  }
  return "Something went wrong while generating a response. Please try again.";
}
