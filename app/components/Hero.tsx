import { siteConfig } from "../lib/siteConfig";

export default function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-zinc-800">
      <div className="mx-auto max-w-7xl px-6 py-28 text-center">
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
          {siteConfig.name}
        </h1>

        <p className="mt-6 text-xl text-zinc-400">
          {siteConfig.description}
        </p>

        <p className="mt-4 max-w-2xl mx-auto text-zinc-500">
          Join competitive gaming tournaments, climb leaderboards, and prove your skill against top players.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row justify-center gap-4">
          <button className="rounded-xl bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500">
            Browse Tournaments
          </button>

          <button className="rounded-xl border border-zinc-700 px-6 py-3 hover:bg-zinc-900">
            Create Account
          </button>
        </div>
      </div>
    </section>
  );
}