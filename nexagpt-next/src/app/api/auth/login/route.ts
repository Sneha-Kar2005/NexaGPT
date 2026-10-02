import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { User } from "@/models/User";
import { ensureDB, jsonError } from "@/lib/api";
import { createSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Log in with email and password. */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { email?: unknown; password?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!email || !password) return jsonError("Please enter your email and password.", 400);

  const dbError = await ensureDB();
  if (dbError) return dbError;

  try {
    const user = await User.findOne({ email });
    // Same message for unknown email and wrong password, so accounts can't be probed.
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return jsonError("Incorrect email or password.", 401);
    }
    await createSession(String(user._id));
    return NextResponse.json({ id: String(user._id), name: user.name, email: user.email });
  } catch (err) {
    console.error("Login failed:", err);
    return jsonError(err instanceof Error && /AUTH_SECRET/.test(err.message) ? err.message : "Could not log in", 500);
  }
}
