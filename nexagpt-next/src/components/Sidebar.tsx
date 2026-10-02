"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronsUpDown, Ellipsis, LogOut, PanelLeftClose, Pencil, Search, SquarePen, Trash2, X } from "lucide-react";
import { useChat } from "./ChatProvider";
import { ConfirmDialog } from "./ConfirmDialog";
import { Logo } from "./Logo";
import { Avatar, logout, type SessionUser } from "./Avatar";
import { cn, groupThreads } from "@/lib/utils";
import type { ThreadSummary } from "@/lib/types";

interface Props {
  user: SessionUser;
  modelName: string;
  onToggle: () => void;
  /** Called after navigating (used to close the mobile drawer). */
  onNavigate?: () => void;
}

export function Sidebar({ user, modelName, onToggle, onNavigate }: Props) {
  const { threads, threadsLoading, activeId, newChat, openThread, renameThread, deleteThread } = useChat();
  const [query, setQuery] = useState("");
  const [menuId, setMenuId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ThreadSummary | null>(null);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groupThreads(q ? threads.filter((t) => t.title.toLowerCase().includes(q)) : threads);
  }, [threads, query]);

  // Close the "..." menu on any outside click.
  useEffect(() => {
    if (!menuId) return;
    const close = () => setMenuId(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menuId]);

  const handleNewChat = () => {
    newChat();
    onNavigate?.();
  };

  return (
    <nav className="flex h-full flex-col text-sm" aria-label="Chat history">
      <div className="flex items-center justify-between px-3 pt-3 pb-1">
        <button
          onClick={handleNewChat}
          className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-hover"
          aria-label="NexaGPT home"
        >
          <Logo className="size-7" />
          <span className="text-base font-semibold">NexaGPT</span>
        </button>
        <button
          onClick={onToggle}
          className="rounded-lg p-2 text-muted hover:bg-hover hover:text-fg"
          aria-label="Close sidebar"
          title="Close sidebar"
        >
          <PanelLeftClose className="size-5" />
        </button>
      </div>

      <div className="space-y-0.5 px-3 py-2">
        <button
          onClick={handleNewChat}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-hover"
          title="New chat (Ctrl+Shift+O)"
        >
          <SquarePen className="size-[18px]" />
          New chat
        </button>
        <label className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 focus-within:bg-hover hover:bg-hover">
          <Search className="size-[18px] shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats"
            className="w-full bg-transparent outline-none placeholder:text-fg"
          />
          {query && (
            <button onClick={() => setQuery("")} aria-label="Clear search" className="text-muted hover:text-fg">
              <X className="size-4" />
            </button>
          )}
        </label>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {threadsLoading ? (
          <div className="space-y-2 px-2.5 pt-4">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="h-4 animate-pulse rounded bg-hover" style={{ width: `${85 - i * 8}%` }} />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <p className="px-2.5 pt-4 text-subtle">{query ? "No chats found." : "Your chats will appear here."}</p>
        ) : (
          groups.map((group) => (
            <section key={group.label} className="mt-4">
              <h3 className="sticky top-0 z-[1] bg-sidebar px-2.5 pb-1 text-xs font-medium text-subtle">
                {group.label}
              </h3>
              <ul>
                {group.threads.map((thread) => (
                  <ThreadItem
                    key={thread.id}
                    thread={thread}
                    active={thread.id === activeId}
                    menuOpen={menuId === thread.id}
                    editing={editingId === thread.id}
                    onOpen={() => {
                      openThread(thread.id);
                      onNavigate?.();
                    }}
                    onMenu={() => setMenuId((id) => (id === thread.id ? null : thread.id))}
                    onStartRename={() => {
                      setMenuId(null);
                      setEditingId(thread.id);
                    }}
                    onRename={(title) => {
                      setEditingId(null);
                      if (title.trim() && title.trim() !== thread.title) void renameThread(thread.id, title);
                    }}
                    onCancelRename={() => setEditingId(null)}
                    onDelete={() => {
                      setMenuId(null);
                      setPendingDelete(thread);
                    }}
                  />
                ))}
              </ul>
            </section>
          ))
        )}
      </div>

      <div className="border-t border-border p-3">
        <UserButton user={user} modelName={modelName} />
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete chat?"
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) void deleteThread(pendingDelete.id);
          setPendingDelete(null);
        }}
      >
        This will delete <strong className="text-fg">{pendingDelete?.title}</strong>.
      </ConfirmDialog>
    </nav>
  );
}

interface ThreadItemProps {
  thread: ThreadSummary;
  active: boolean;
  menuOpen: boolean;
  editing: boolean;
  onOpen: () => void;
  onMenu: () => void;
  onStartRename: () => void;
  onRename: (title: string) => void;
  onCancelRename: () => void;
  onDelete: () => void;
}

function ThreadItem(props: ThreadItemProps) {
  const { thread, active, menuOpen, editing } = props;
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  if (editing) {
    return (
      <li className="px-1 py-0.5">
        <input
          ref={inputRef}
          defaultValue={thread.title}
          maxLength={200}
          className="w-full rounded-lg border border-[#339cff] bg-bg px-2 py-1.5 outline-none"
          onKeyDown={(e) => {
            if (e.key === "Enter") props.onRename(e.currentTarget.value);
            if (e.key === "Escape") props.onCancelRename();
          }}
          onBlur={(e) => props.onRename(e.currentTarget.value)}
        />
      </li>
    );
  }

  return (
    <li className="group relative">
      <button
        onClick={props.onOpen}
        title={thread.title}
        className={cn(
          "block w-full truncate rounded-lg py-2 pr-9 pl-2.5 text-left",
          active ? "bg-active" : "hover:bg-hover",
        )}
      >
        {thread.title}
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          props.onMenu();
        }}
        aria-label="Chat options"
        className={cn(
          "absolute top-1/2 right-1.5 -translate-y-1/2 rounded-md p-1 text-muted hover:text-fg",
          menuOpen || active ? "opacity-100" : "opacity-100 md:opacity-0 md:group-hover:opacity-100",
        )}
      >
        <Ellipsis className="size-4" />
      </button>
      {menuOpen && (
        <div
          className="absolute top-full right-0 z-20 mt-1 w-40 rounded-xl border border-border bg-bg p-1.5 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={props.onStartRename}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-hover"
          >
            <Pencil className="size-4" /> Rename
          </button>
          <button
            onClick={props.onDelete}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-danger hover:bg-hover"
          >
            <Trash2 className="size-4" /> Delete
          </button>
        </div>
      )}
    </li>
  );
}

function UserButton({ user, modelName }: { user: SessionUser; modelName: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      {open && (
        <div className="absolute right-0 bottom-full left-0 z-20 mb-2 rounded-2xl border border-border bg-bg p-1.5 shadow-lg">
          <p className="truncate px-2.5 py-2 text-xs text-subtle">{user.email}</p>
          <p className="truncate px-2.5 pb-2 text-xs text-subtle">Model: {modelName}</p>
          <div className="my-1 border-t border-border" />
          <button
            onClick={() => void logout()}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-hover"
          >
            <LogOut className="size-4" /> Log out
          </button>
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-hover"
      >
        <Avatar user={user} />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate font-medium">{user.name}</p>
          <p className="truncate text-xs text-subtle">{user.email}</p>
        </div>
        <ChevronsUpDown className="size-4 shrink-0 text-subtle" />
      </button>
    </div>
  );
}
