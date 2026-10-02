import { NextResponse } from "next/server";
import { connectDB } from "./db";
import { getSessionUserId } from "./auth";

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/** Connects to MongoDB, returning an error response if the database is unreachable. */
export async function ensureDB(): Promise<NextResponse | null> {
  try {
    await connectDB();
    return null;
  } catch (err) {
    console.error("MongoDB connection failed:", err);
    return jsonError(
      "Cannot connect to MongoDB. Make sure it is running and MONGODB_URI in .env.local is correct.",
      503,
    );
  }
}

export function isNonEmptyString(v: unknown, max = 100_000): v is string {
  return typeof v === "string" && v.trim().length > 0 && v.length <= max;
}

/**
 * Resolves the logged-in user's id for an API route. Returns either the id or a
 * 401 response to send back.
 */
export async function requireUser(): Promise<{ userId: string } | { response: NextResponse }> {
  const userId = await getSessionUserId();
  if (!userId) return { response: jsonError("You are not logged in", 401) };
  return { userId };
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
