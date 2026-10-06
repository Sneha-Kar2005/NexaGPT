import type { Metadata } from "next";
import { AuthForm } from "@/components/AuthForm";

export const metadata: Metadata = { title: "Sign up · NexaGPT" };

// Read INVITE_CODE at request time, not build time.
export const dynamic = "force-dynamic";

export default function RegisterPage() {
  return <AuthForm mode="register" requireInvite={Boolean(process.env.INVITE_CODE)} />;
}
