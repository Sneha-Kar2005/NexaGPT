"use client";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  const dbDown = /mongo|ECONNREFUSED|server selection/i.test(error.message);
  return (
    <main className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="max-w-md text-sm text-muted">
        {dbDown
          ? "Cannot connect to MongoDB. Make sure it is running and MONGODB_URI in .env.local is correct."
          : "An unexpected error occurred. Please try again."}
      </p>
      <button onClick={reset} className="rounded-full bg-fg px-4 py-2 text-sm font-medium text-bg">
        Try again
      </button>
    </main>
  );
}
