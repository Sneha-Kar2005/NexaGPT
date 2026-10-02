"use client";

import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import { useChat } from "./ChatProvider";
import { Sidebar } from "./Sidebar";
import { ChatHeader } from "./ChatHeader";
import { ChatWindow } from "./ChatWindow";
import type { SessionUser } from "./Avatar";

const SIDEBAR_KEY = "nexagpt-sidebar";

export function ChatApp({ modelName, user }: { modelName: string; user: SessionUser }) {
  const { toast, dismissToast, newChat } = useChat();
  // Desktop: collapsible column. Mobile: overlay drawer.
  const [desktopOpen, setDesktopOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(SIDEBAR_KEY) === "closed") setDesktopOpen(false);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const toggleSidebar = useCallback(() => {
    if (window.matchMedia("(min-width: 768px)").matches) {
      setDesktopOpen((open) => {
        try {
          localStorage.setItem(SIDEBAR_KEY, open ? "closed" : "open");
        } catch {
          /* storage unavailable */
        }
        return !open;
      });
    } else {
      setMobileOpen((open) => !open);
    }
  }, []);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  // Ctrl/Cmd + Shift + O starts a new chat (same shortcut as ChatGPT).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "o") {
        e.preventDefault();
        newChat();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [newChat]);

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-bg text-fg">
      {/* Desktop sidebar */}
      <aside
        className={`hidden shrink-0 overflow-hidden border-r border-border bg-sidebar transition-[width] duration-200 md:block ${
          desktopOpen ? "w-[260px]" : "w-0 border-r-0"
        }`}
      >
        <div className="h-full w-[260px]">
          <Sidebar user={user} modelName={modelName} onToggle={toggleSidebar} />
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={closeMobile} />
          <aside className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] bg-sidebar shadow-xl">
            <Sidebar user={user} modelName={modelName} onToggle={closeMobile} onNavigate={closeMobile} />
          </aside>
        </div>
      )}

      <main className="flex min-w-0 flex-1 flex-col">
        <ChatHeader user={user} modelName={modelName} sidebarOpen={desktopOpen} onToggleSidebar={toggleSidebar} />
        <ChatWindow />
      </main>

      {toast && (
        <div
          role="alert"
          className="fixed bottom-6 left-1/2 z-50 flex max-w-[90vw] -translate-x-1/2 items-center gap-3 rounded-xl bg-[#e02e2a] px-4 py-3 text-sm text-white shadow-lg"
        >
          <span>{toast}</span>
          <button onClick={dismissToast} aria-label="Dismiss" className="rounded p-0.5 hover:bg-white/20">
            <X className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}
