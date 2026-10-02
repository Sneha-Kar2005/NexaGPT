import { redirect } from "next/navigation";
import { ChatProvider } from "@/components/ChatProvider";
import { ChatApp } from "@/components/ChatApp";
import { getCurrentUser } from "@/lib/auth";
import { DEFAULT_MODEL, modelLabel } from "@/lib/utils";

export const dynamic = "force-dynamic";

// The chat UI lives in this shared layout so it stays mounted while the URL
// switches between "/" and "/c/:threadId" (just like ChatGPT).
export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  // Valid cookie but no matching account (e.g. deleted): clear the session.
  if (!user) redirect("/api/auth/logout");

  const model = modelLabel(process.env.GEMINI_MODEL || DEFAULT_MODEL);
  return (
    <ChatProvider>
      <ChatApp modelName={model} user={{ name: user.name, email: user.email }} />
      {children}
    </ChatProvider>
  );
}
