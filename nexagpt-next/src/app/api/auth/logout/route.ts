import { NextResponse, type NextRequest } from "next/server";
import { deleteSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Log out (called by the UI). */
export async function POST() {
  await deleteSession();
  return NextResponse.json({ success: true });
}

/** Log out and go to the login page (used when a session points to a deleted account). */
export async function GET(req: NextRequest) {
  await deleteSession();
  return NextResponse.redirect(new URL("/login", req.url));
}
