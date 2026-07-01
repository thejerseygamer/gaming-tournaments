import Link from "next/link";

const playerSteps = [
  {
    title: "Create your account",
    body: "Sign up with your email, gamer tag, platform, and favorite team so other players know who they are facing.",
  },
  {
    title: "Join a tournament",
    body: "Open the tournaments page, choose an event, and join while registration is open.",
  },
  {
    title: "Check your matchup",
    body: "Once an admin generates the bracket, go to Brackets or My Tournaments to see who you play.",
  },
  {
    title: "Play your match",
    body: "Play your game outside BattleGrid, then come back to submit the final score.",
  },
  {
    title: "Upload score proof",
    body: "Submit the score and upload a screenshot if required. Admins can review the proof before approving the result.",
  },
  {
    title: "Advance or finish",
    body: "When your result is approved, the winner advances and both players get notifications.",
  },
];

const adminSteps = [
  {
    title: "Create tournaments",
    body: "Use the Admin Dashboard to create events with game, platform, prize pool, entry fee, max players, rules, and start time.",
  },
  {
    title: "Manage players",
    body: "Open Admin Players to view users, player stats, and manage admin access.",
  },
  {
    title: "Generate brackets",
    body: "When enough players join, open Admin Tournaments and generate a single-elimination bracket.",
  },
  {
    title: "Review scores",
    body: "Use Score Reviews to approve submitted scores, dismiss bad submissions, and advance winners.",
  },
  {
    title: "Send announcements",
    body: "Use Announcements to notify all users, admins, tournament players, or selected accounts.",
  },
];

const quickLinks = [
  {
    href: "/tournaments",
    title: "Browse Tournaments",
    body: "Find open tournaments and join events.",
  },
  {
    href: "/my-tournaments",
    title: "My Tournaments",
    body: "View your joined events, matches, and score submissions.",
  },
  {
    href: "/brackets",
    title: "Brackets",
    body: "Track tournament rounds, matchups, and winners.",
  },
  {
    href: "/leaderboard",
    title: "Leaderboard",
    body: "See top players, records, win rates, and profiles.",
  },
  {
    href: "/notifications",
    title: "Notifications",
    body: "View tournament updates, score results, and announcements.",
  },
  {
    href: "/profile",
    title: "Profile",
    body: "Update your gamer tag, platform, favorite team, and account details.",
  },
];

export default function HelpPage() {
  return (
    <main className="min-h-screen bg-black p-6 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Link href="/" className="text-sm text-gray-400 hover:text-white">
            ← Back Home
          </Link>

          <Link
            href="/tournaments"
            className="text-sm text-gray-400 hover:text-white"
          >
            Browse Tournaments →
          </Link>
        </div>

        <section className="mb-8 rounded-3xl border border-red-900/60 bg-red-950/20 p-8">
          <p className="mb-3 text-sm font-black uppercase tracking-[0.3em] text-red-400">
            BattleGrid Guide
          </p>

          <h1 className="mb-4 text-5xl font-black">How BattleGrid Works</h1>

          <p className="max-w-3xl text-lg leading-8 text-gray-300">
            BattleGrid helps players join tournaments, track brackets, submit
            scores, upload proof, receive notifications, and climb the
            leaderboard.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="rounded-xl bg-white px-6 py-4 text-center font-black text-black hover:bg-gray-200"
            >
              Create Account
            </Link>

            <Link
              href="/tournaments"
              className="rounded-xl border border-gray-700 px-6 py-4 text-center font-black text-white hover:bg-gray-900"
            >
              Find Tournaments
            </Link>

            <Link
              href="/leaderboard"
              className="rounded-xl border border-gray-700 px-6 py-4 text-center font-black text-white hover:bg-gray-900"
            >
              View Leaderboard
            </Link>
          </div>
        </section>

        <section className="mb-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-gray-800 bg-gray-950 p-6">
            <p className="mb-2 text-sm text-gray-500">For Players</p>
            <h2 className="text-3xl font-black">Join. Play. Report.</h2>
            <p className="mt-3 text-sm leading-6 text-gray-400">
              Players join tournaments, play matches, submit scores, and track
              results from their dashboard.
            </p>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gray-950 p-6">
            <p className="mb-2 text-sm text-gray-500">For Admins</p>
            <h2 className="text-3xl font-black">Create. Review. Advance.</h2>
            <p className="mt-3 text-sm leading-6 text-gray-400">
              Admins create events, generate brackets, review scores, and send
              announcements.
            </p>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gray-950 p-6">
            <p className="mb-2 text-sm text-gray-500">For Rankings</p>
            <h2 className="text-3xl font-black">Win. Climb. Prove it.</h2>
            <p className="mt-3 text-sm leading-6 text-gray-400">
              Completed matches feed player records, win rates, public profiles,
              and leaderboard rankings.
            </p>
          </div>
        </section>

        <section className="mb-8 grid gap-8 lg:grid-cols-2">
          <section className="rounded-2xl border border-gray-800 bg-gray-950 p-6">
            <p className="mb-3 text-sm font-black uppercase tracking-[0.25em] text-red-400">
              Player Flow
            </p>

            <h2 className="mb-6 text-3xl font-black">How to compete</h2>

            <div className="grid gap-4">
              {playerSteps.map((step, index) => (
                <article
                  key={step.title}
                  className="rounded-xl border border-gray-800 bg-black p-5"
                >
                  <div className="flex gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-red-700 bg-red-950/40 font-black text-red-300">
                      {index + 1}
                    </div>

                    <div>
                      <h3 className="text-xl font-bold">{step.title}</h3>

                      <p className="mt-2 text-sm leading-6 text-gray-400">
                        {step.body}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-gray-800 bg-gray-950 p-6">
            <p className="mb-3 text-sm font-black uppercase tracking-[0.25em] text-red-400">
              Admin Flow
            </p>

            <h2 className="mb-6 text-3xl font-black">How to run events</h2>

            <div className="grid gap-4">
              {adminSteps.map((step, index) => (
                <article
                  key={step.title}
                  className="rounded-xl border border-gray-800 bg-black p-5"
                >
                  <div className="flex gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-red-700 bg-red-950/40 font-black text-red-300">
                      {index + 1}
                    </div>

                    <div>
                      <h3 className="text-xl font-bold">{step.title}</h3>

                      <p className="mt-2 text-sm leading-6 text-gray-400">
                        {step.body}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </section>

        <section className="mb-8 rounded-2xl border border-gray-800 bg-gray-950 p-6">
          <p className="mb-3 text-sm font-black uppercase tracking-[0.25em] text-red-400">
            Quick Links
          </p>

          <h2 className="mb-6 text-3xl font-black">Where to go</h2>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-xl border border-gray-800 bg-black p-5 hover:border-red-700 hover:bg-red-950/20"
              >
                <h3 className="text-xl font-black">{link.title}</h3>

                <p className="mt-2 text-sm leading-6 text-gray-400">
                  {link.body}
                </p>
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-yellow-800 bg-yellow-950/20 p-6">
          <h2 className="mb-3 text-3xl font-black text-yellow-300">
            Important Match Rules
          </h2>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-yellow-900 bg-black p-5">
              <h3 className="text-xl font-bold">Submit accurate scores</h3>

              <p className="mt-2 text-sm leading-6 text-gray-400">
                Scores should match the final result of the game. If proof is
                required, upload a clear screenshot.
              </p>
            </div>

            <div className="rounded-xl border border-yellow-900 bg-black p-5">
              <h3 className="text-xl font-bold">Wait for admin review</h3>

              <p className="mt-2 text-sm leading-6 text-gray-400">
                Some results may need admin approval before the winner advances
                in the bracket.
              </p>
            </div>

            <div className="rounded-xl border border-yellow-900 bg-black p-5">
              <h3 className="text-xl font-bold">Check notifications</h3>

              <p className="mt-2 text-sm leading-6 text-gray-400">
                BattleGrid sends alerts for registration, brackets, score
                submissions, match results, and announcements.
              </p>
            </div>

            <div className="rounded-xl border border-yellow-900 bg-black p-5">
              <h3 className="text-xl font-bold">Keep your profile updated</h3>

              <p className="mt-2 text-sm leading-6 text-gray-400">
                Your gamer tag, platform, and favorite team appear across
                tournaments, profiles, and the leaderboard.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}