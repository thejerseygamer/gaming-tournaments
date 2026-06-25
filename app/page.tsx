export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <section className="mx-auto max-w-7xl px-6 py-20">
        <h1 className="text-6xl font-bold">
          Gaming Tournament Platform
        </h1>

        <p className="mt-6 max-w-2xl text-xl text-zinc-400">
          Compete. Win. Climb the leaderboard.
        </p>

        <div className="mt-10 flex gap-4">
          <button className="rounded-xl bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500">
            Browse Tournaments
          </button>

          <button className="rounded-xl border border-zinc-700 px-6 py-3 hover:bg-zinc-900">
            Player Login
          </button>
        </div>
      </section>
    </main>
  );
}