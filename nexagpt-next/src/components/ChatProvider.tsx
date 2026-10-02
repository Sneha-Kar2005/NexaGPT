"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import type { ChatMessage, ChatRequest, ChatStreamEvent, ThreadDetail, ThreadSummary } from "@/lib/types";
import { initialTitle, uuid } from "@/lib/utils";

export interface UIMessage extends ChatMessage {
  status?: "streaming" | "error";
  error?: string;
  /** Transient progress text, e.g. "Searching for images…" */
  activity?: string;
}

interface ChatContextValue {
  threads: ThreadSummary[];
  threadsLoading: boolean;
  activeId: string | null;
  messages: UIMessage[];
  threadLoading: boolean;
  /** True while a reply is being generated (in any chat). */
  isStreaming: boolean;
  /** True while a reply is being generated in the chat currently shown. */
  isStreamingHere: boolean;
  send: (content: string) => void;
  stop: () => void;
  regenerate: () => void;
  editMessage: (messageId: string, content: string) => void;
  newChat: () => void;
  openThread: (id: string) => void;
  renameThread: (id: string, title: string) => Promise<void>;
  deleteThread: (id: string) => Promise<void>;
  deleteAllThreads: () => Promise<void>;
  toast: string | null;
  showToast: (message: string) => void;
  dismissToast: () => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used inside <ChatProvider>");
  return ctx;
}

interface LiveStream {
  threadId: string;
  messages: UIMessage[];
  controller: AbortController;
}

/** fetch() that sends the user to the login page when their session has expired. */
async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init);
  if (res.status === 401) {
    window.location.assign("/login");
    throw new Error("Your session has expired. Please log in again.");
  }
  return res;
}

async function readError(res: Response): Promise<string> {
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  return data?.error ?? `Request failed (${res.status})`;
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const routeId = pathname?.startsWith("/c/") ? decodeURIComponent(pathname.slice(3).split("/")[0]) : null;

  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(routeId);
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const activeIdRef = useRef<string | null>(routeId);
  const liveRef = useRef<LiveStream | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }, []);
  const dismissToast = useCallback(() => setToast(null), []);

  const refreshThreads = useCallback(async () => {
    try {
      const res = await apiFetch("/api/threads", { cache: "no-store" });
      if (!res.ok) throw new Error(await readError(res));
      setThreads((await res.json()) as ThreadSummary[]);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to load chats");
    } finally {
      setThreadsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void refreshThreads();
  }, [refreshThreads]);

  // Sync the displayed conversation with the URL (/ or /c/:id).
  useEffect(() => {
    activeIdRef.current = routeId;
    setActiveId(routeId);

    if (!routeId) {
      setMessages([]);
      setThreadLoading(false);
      return;
    }

    // A reply is currently streaming into this chat: show the live state.
    const live = liveRef.current;
    if (live && live.threadId === routeId) {
      setMessages(live.messages);
      setThreadLoading(false);
      return;
    }

    let cancelled = false;
    setMessages([]);
    setThreadLoading(true);
    (async () => {
      try {
        const res = await apiFetch(`/api/threads/${encodeURIComponent(routeId)}`, { cache: "no-store" });
        if (cancelled) return;
        if (res.status === 404) {
          showToast("That chat doesn't exist or was deleted.");
          router.replace("/");
          return;
        }
        if (!res.ok) throw new Error(await readError(res));
        const data = (await res.json()) as ThreadDetail;
        if (!cancelled && activeIdRef.current === routeId) setMessages(data.messages);
      } catch (err) {
        if (!cancelled) showToast(err instanceof Error ? err.message : "Failed to load chat");
      } finally {
        if (!cancelled) setThreadLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [routeId, router, showToast]);

  /** Streams a reply from /api/chat into the given conversation. */
  const runStream = useCallback(
    async (threadId: string, base: UIMessage[], request: ChatRequest) => {
      const controller = new AbortController();
      let assistant: UIMessage = {
        id: request.assistantMessageId,
        role: "assistant",
        content: "",
        createdAt: new Date().toISOString(),
        status: "streaming",
      };
      const live: LiveStream = { threadId, messages: [...base, assistant], controller };
      liveRef.current = live;
      setStreamingId(threadId);

      const commit = () => {
        live.messages = [...base, assistant];
        if (activeIdRef.current === threadId) setMessages(live.messages);
      };
      commit();

      try {
        const res = await apiFetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) throw new Error(await readError(res));

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            const event = JSON.parse(line) as ChatStreamEvent;
            if (event.type === "delta") {
              assistant = { ...assistant, content: assistant.content + event.text, activity: undefined };
              commit();
            } else if (event.type === "status") {
              assistant = { ...assistant, activity: event.text };
              commit();
            } else if (event.type === "images") {
              assistant = { ...assistant, images: [...(assistant.images ?? []), ...event.images], activity: undefined };
              commit();
            } else if (event.type === "title") {
              setThreads((prev) => prev.map((t) => (t.id === threadId ? { ...t, title: event.title } : t)));
            } else if (event.type === "error") {
              assistant = { ...assistant, status: "error", error: event.message };
              commit();
            }
          }
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          assistant = {
            ...assistant,
            status: "error",
            error: err instanceof Error ? err.message : "Network error. Please try again.",
          };
        }
      } finally {
        assistant = { ...assistant, activity: undefined };
        if (assistant.status === "streaming") assistant = { ...assistant, status: undefined };
        // Stopped before any text arrived: drop the empty bubble.
        if (!assistant.content && !assistant.images?.length && assistant.status !== "error") {
          live.messages = base;
          if (activeIdRef.current === threadId) setMessages(base);
        } else {
          commit();
        }
        if (liveRef.current === live) liveRef.current = null;
        setStreamingId(null);
        void refreshThreads();
      }
    },
    [refreshThreads],
  );

  const send = useCallback(
    (raw: string) => {
      const content = raw.trim();
      if (!content || liveRef.current) return;

      const isNew = !activeIdRef.current;
      const threadId = activeIdRef.current ?? uuid();
      const now = new Date().toISOString();
      const userMessage: UIMessage = { id: uuid(), role: "user", content, createdAt: now };
      // Client-only error bubbles are not part of the conversation.
      const base = [...messages.filter((m) => m.status !== "error"), userMessage];
      const request: ChatRequest = {
        action: "send",
        threadId,
        content,
        userMessageId: userMessage.id,
        assistantMessageId: uuid(),
      };

      setThreads((prev) => {
        const existing = prev.find((t) => t.id === threadId);
        const entry: ThreadSummary = existing
          ? { ...existing, updatedAt: now }
          : { id: threadId, title: initialTitle(content), updatedAt: now };
        return [entry, ...prev.filter((t) => t.id !== threadId)];
      });

      const streaming = runStream(threadId, base, request);
      if (isNew) {
        // Update the URL without remounting; the route effect picks up the live stream.
        window.history.pushState(null, "", `/c/${threadId}`);
      }
      void streaming;
    },
    [messages, runStream],
  );

  const regenerate = useCallback(() => {
    const threadId = activeIdRef.current;
    if (!threadId || liveRef.current) return;
    const base = [...messages];
    while (base.length && base[base.length - 1].role === "assistant") base.pop();
    if (!base.length) return;
    void runStream(threadId, base, { action: "regenerate", threadId, assistantMessageId: uuid() });
  }, [messages, runStream]);

  const editMessage = useCallback(
    (messageId: string, raw: string) => {
      const content = raw.trim();
      const threadId = activeIdRef.current;
      if (!threadId || !content || liveRef.current) return;
      const idx = messages.findIndex((m) => m.id === messageId && m.role === "user");
      if (idx === -1) return;
      const base = [...messages.slice(0, idx), { ...messages[idx], content }];
      void runStream(threadId, base, {
        action: "edit",
        threadId,
        content,
        userMessageId: messageId,
        assistantMessageId: uuid(),
      });
    },
    [messages, runStream],
  );

  const stop = useCallback(() => {
    liveRef.current?.controller.abort();
  }, []);

  const newChat = useCallback(() => {
    if (activeIdRef.current) router.push("/");
  }, [router]);

  const openThread = useCallback(
    (id: string) => {
      if (id !== activeIdRef.current) router.push(`/c/${encodeURIComponent(id)}`);
    },
    [router],
  );

  const renameThread = useCallback(
    async (id: string, title: string) => {
      const trimmed = title.trim();
      if (!trimmed) return;
      const previous = threads;
      setThreads((prev) => prev.map((t) => (t.id === id ? { ...t, title: trimmed } : t)));
      try {
        const res = await apiFetch(`/api/threads/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: trimmed }),
        });
        if (!res.ok) throw new Error(await readError(res));
      } catch (err) {
        setThreads(previous);
        showToast(err instanceof Error ? err.message : "Failed to rename chat");
      }
    },
    [threads, showToast],
  );

  const deleteThread = useCallback(
    async (id: string) => {
      if (liveRef.current?.threadId === id) liveRef.current.controller.abort();
      try {
        const res = await apiFetch(`/api/threads/${encodeURIComponent(id)}`, { method: "DELETE" });
        if (!res.ok && res.status !== 404) throw new Error(await readError(res));
        setThreads((prev) => prev.filter((t) => t.id !== id));
        if (activeIdRef.current === id) router.push("/");
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Failed to delete chat");
      }
    },
    [router, showToast],
  );

  const deleteAllThreads = useCallback(async () => {
    liveRef.current?.controller.abort();
    try {
      const res = await apiFetch("/api/threads", { method: "DELETE" });
      if (!res.ok) throw new Error(await readError(res));
      setThreads([]);
      if (activeIdRef.current) router.push("/");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to delete chats");
    }
  }, [router, showToast]);

  const value = useMemo<ChatContextValue>(
    () => ({
      threads,
      threadsLoading,
      activeId,
      messages,
      threadLoading,
      isStreaming: streamingId !== null,
      isStreamingHere: streamingId !== null && streamingId === activeId,
      send,
      stop,
      regenerate,
      editMessage,
      newChat,
      openThread,
      renameThread,
      deleteThread,
      deleteAllThreads,
      toast,
      showToast,
      dismissToast,
    }),
    [
      threads,
      threadsLoading,
      activeId,
      messages,
      threadLoading,
      streamingId,
      send,
      stop,
      regenerate,
      editMessage,
      newChat,
      openThread,
      renameThread,
      deleteThread,
      deleteAllThreads,
      toast,
      showToast,
      dismissToast,
    ],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
