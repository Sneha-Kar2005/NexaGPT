import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <Link href="/" className="rounded-full bg-fg px-4 py-2 text-sm font-medium text-bg">
        Back to NexaGPT
      </Link>
    </main>
  );
}
