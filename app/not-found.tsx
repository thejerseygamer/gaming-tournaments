import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="min-h-screen bg-black p-6 text-white">
      <div className="mx-auto flex min-h-[70vh] max-w-4xl items-center justify-center">
        <section className="w-full rounded-3xl border border-red-900 bg-red-950/20 p-8 text-center">
          <p className="mb-4 text-sm font-black uppercase tracking-[0.3em] text-red-400">
            BattleGrid Error
          </p>

          <h1 className="mb-4 text-6xl font-black">404</h1>

          <h2 className="mb-4 text-3xl font-black">Page Not Found</h2>

          <p className="mx-auto mb-8 max-w-2xl text-gray-300">
            This page does not exist, was moved, or the link is incorrect.
          </p>

          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/"
              className="rounded-xl bg-white px-6 py-4 text-center font-black text-black hover:bg-gray-200"
            >
              Go Home
            </Link>

            <Link
              href="/tournaments"
              className="rounded-xl border border-gray-700 px-6 py-4 text-center font-black text-white hover:bg-gray-900"
            >
              Browse Tournaments
            </Link>

            <Link
              href="/leaderboard"
              className="rounded-xl border border-gray-700 px-6 py-4 text-center font-black text-white hover:bg-gray-900"
            >
              Leaderboard
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}