"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-col justify-center px-5 py-20">
      <h1 className="font-display text-4xl font-light text-ink">Something went wrong</h1>
      <p className="mt-3 text-muted">The page could not load. Try again in a moment.</p>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-8 h-12 w-fit rounded-full bg-ink px-6 text-sm text-card"
      >
        Try again
      </button>
    </main>
  );
}
