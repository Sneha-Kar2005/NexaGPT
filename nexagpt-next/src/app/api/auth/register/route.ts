import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { User } from "@/models/User";
import { Thread } from "@/models/Thread";
import { EMAIL_RE, ensureDB, jsonError } from "@/lib/api";
import { createSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Create an account and log in. */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    name?: unknown;
    email?: unknown;
    password?: unknown;
  } | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!name || name.length > 50) return jsonError("Please enter your name (max 50 characters).", 400);
  if (!EMAIL_RE.test(email) || email.length > 254) return jsonError("Please enter a valid email address.", 400);
  if (password.length < 8 || password.length > 72) {
    return jsonError("Password must be between 8 and 72 characters.", 400);
  }

  const dbError = await ensureDB();
  if (dbError) return dbError;

  try {
    if (await User.exists({ email })) {
      return jsonError("An account with this email already exists. Try logging in.", 409);
    }
    const isFirstUser = (await User.estimatedDocumentCount()) === 0;
    const user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, 10) });
    const userId = String(user._id);

    // Chats created before login existed belong to the first account.
    if (isFirstUser) {
      await Thread.updateMany({ userId: { $exists: false } }, { $set: { userId } }, { timestamps: false });
    }

    await createSession(userId);
    return NextResponse.json({ id: userId, name: user.name, email: user.email }, { status: 201 });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      return jsonError("An account with this email already exists. Try logging in.", 409);
    }
    console.error("Register failed:", err);
    return jsonError(err instanceof Error && /AUTH_SECRET/.test(err.message) ? err.message : "Could not create account", 500);
  }
}
