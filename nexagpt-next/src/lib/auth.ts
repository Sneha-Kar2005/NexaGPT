import "server-only";
import { cookies } from "next/headers";
import { connectDB } from "./db";
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession, verifySession } from "./session";
import { User } from "@/models/User";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
}

export async function createSession(userId: string): Promise<void> {
  const token = await signSession({ userId });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function deleteSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/** The logged-in user's id from the session cookie, or null. */
export async function getSessionUserId(): Promise<string | null> {
  const session = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  return session?.userId ?? null;
}

/** The logged-in user loaded from the database, or null. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const userId = await getSessionUserId();
  if (!userId) return null;
  await connectDB();
  const user = await User.findById(userId, { name: 1, email: 1 }).lean().catch(() => null);
  if (!user) return null;
  return { id: String(user._id), name: user.name, email: user.email };
}
