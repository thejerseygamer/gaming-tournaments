export default function LoadingPage() {
  return (
    <main className="min-h-screen bg-black p-6 text-white">
      <div className="mx-auto flex min-h-[70vh] max-w-4xl items-center justify-center">
        <section className="w-full rounded-3xl border border-gray-800 bg-gray-950 p-8 text-center">
          <div className="mx-auto mb-6 h-16 w-16 animate-spin rounded-full border-4 border-gray-800 border-t-red-600" />

          <p className="mb-4 text-sm font-black uppercase tracking-[0.3em] text-red-400">
            BattleGrid
          </p>

          <h1 className="mb-4 text-4xl font-black">Loading...</h1>

          <p className="mx-auto max-w-2xl text-gray-400">
            Getting tournaments, brackets, player stats, and match data ready.
          </p>
        </section>
      </div>
    </main>
  );
}