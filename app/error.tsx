"use client";

import Link from "next/link";
import { useEffect } from "react";

type ErrorPageProps = {
  error: Error & {
    digest?: string;
  };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error("BattleGrid page error:", error);
  }, [error]);

  return (
    <main className="min-h-screen bg-black p-6 text-white">
      <div className="mx-auto flex min-h-[70vh] max-w-4xl items-center justify-center">
        <section className="w-full rounded-3xl border border-red-900 bg-red-950/20 p-8 text-center">
          <p className="mb-4 text-sm font-black uppercase tracking-[0.3em] text-red-400">
            BattleGrid Error
          </p>

          <h1 className="mb-4 text-5xl font-black">Something Went Wrong</h1>

          <p className="mx-auto mb-6 max-w-2xl text-gray-300">
            BattleGrid hit an unexpected error. You can try again, go back home,
            or open tournaments.
          </p>

          {error.message && (
            <p className="mb-8 rounded-xl border border-gray-800 bg-black p-4 text-left text-sm text-gray-400">
              {error.message}
            </p>
          )}

          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={reset}
              className="rounded-xl bg-white px-6 py-4 text-center font-black text-black hover:bg-gray-200"
            >
              Try Again
            </button>

            <Link
              href="/"
              className="rounded-xl border border-gray-700 px-6 py-4 text-center font-black text-white hover:bg-gray-900"
            >
              Go Home
            </Link>

            <Link
              href="/tournaments"
              className="rounded-xl border border-gray-700 px-6 py-4 text-center font-black text-white hover:bg-gray-900"
            >
              Browse Tournaments
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}