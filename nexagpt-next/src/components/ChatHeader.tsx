"use client";

import { useEffect, useRef, useState } from "react";
import { Check, LogOut, Monitor, Moon, PanelLeftOpen, SquarePen, Sun, Trash2 } from "lucide-react";
import { useChat } from "./ChatProvider";
import { ConfirmDialog } from "./ConfirmDialog";
import { Avatar, logout, type SessionUser } from "./Avatar";
import { useTheme, type ThemePref } from "./useTheme";
import { cn } from "@/lib/utils";

const THEMES: { value: ThemePref; label: string; icon: typeof Sun }[] = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

interface Props {
  user: SessionUser;
  modelName: string;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export function ChatHeader({ user, modelName, sidebarOpen, onToggleSidebar }: Props) {
  const { newChat, deleteAllThreads, threads } = useChat();
  const { theme, setTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between px-2 md:px-3">
      <div className="flex items-center gap-1">
        {/* Always visible on mobile; on desktop only when the sidebar is collapsed. */}
        <div className={cn("flex items-center gap-1", sidebarOpen && "md:hidden")}>
          <button
            onClick={onToggleSidebar}
            className="rounded-lg p-2 text-muted hover:bg-hover hover:text-fg"
            aria-label="Open sidebar"
            title="Open sidebar"
          >
            <PanelLeftOpen className="size-5" />
          </button>
          <button
            onClick={newChat}
            className="rounded-lg p-2 text-muted hover:bg-hover hover:text-fg"
            aria-label="New chat"
            title="New chat"
          >
            <SquarePen className="size-5" />
          </button>
        </div>
        <div className="flex items-baseline gap-1.5 rounded-lg px-2 py-1.5 text-lg">
          <span className="font-semibold">NexaGPT</span>
          <span className="text-sm text-subtle">{modelName.replace(/^Gemini /, "")}</span>
        </div>
      </div>

      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="flex size-9 items-center justify-center rounded-full hover:bg-hover"
          aria-label="Open account menu"
          aria-expanded={menuOpen}
        >
          <Avatar user={user} />
        </button>
        {menuOpen && (
          <div className="absolute top-full right-0 z-30 mt-2 w-60 rounded-2xl border border-border bg-bg p-2 text-sm shadow-xl">
            <div className="flex items-center gap-2.5 px-2.5 py-2">
              <Avatar user={user} />
              <div className="min-w-0 leading-tight">
                <p className="truncate font-medium">{user.name}</p>
                <p className="truncate text-xs text-subtle">{user.email}</p>
              </div>
            </div>
            <div className="my-1.5 border-t border-border" />
            <p className="px-2.5 pt-1 pb-1.5 text-xs font-medium text-subtle">Theme</p>
            {THEMES.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-hover"
              >
                <Icon className="size-4" />
                <span className="flex-1 text-left">{label}</span>
                {theme === value && <Check className="size-4" />}
              </button>
            ))}
            <div className="my-1.5 border-t border-border" />
            <button
              disabled={threads.length === 0}
              onClick={() => {
                setMenuOpen(false);
                setConfirmClear(true);
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-danger hover:bg-hover disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <Trash2 className="size-4" /> Delete all chats
            </button>
            <button
              onClick={() => void logout()}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-hover"
            >
              <LogOut className="size-4" /> Log out
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmClear}
        title="Delete all chats?"
        confirmLabel="Delete all"
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          setConfirmClear(false);
          void deleteAllThreads();
        }}
      >
        This will permanently delete all {threads.length} of your chats. This can&apos;t be undone.
      </ConfirmDialog>
    </header>
  );
}
