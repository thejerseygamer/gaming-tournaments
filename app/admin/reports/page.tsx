"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { checkIsAdmin } from "../../lib/admin";

type Tournament = {
  id: string;
  name: string;
  game: string | null;
  platform: string | null;
  registration_open: boolean;
  created_at: string;
};

type TournamentPlayer = {
  tournament_id: string;
  player_id: string;
};

type MatchRow = {
  id: string;
  tournament_id: string;
  status: string | null;
  winner_id: string | null;
  score_submitted_by: string | null;
  created_at: string;
};

type Profile = {
  id: string;
  gamer_tag: string | null;
  platform: string | null;
  is_admin: boolean | null;
  created_at: string | null;
};

type SupportRequest = {
  id: string;
  status: string;
  category: string;
  created_at: string;
};

type LeaderboardPlayer = {
  id: string;
  gamer_tag: string | null;
  platform: string | null;
  wins: number;
  losses: number;
  win_percentage: number;
  tournaments_won: number;
};

function formatDateTime(value: string | null) {
  if (!value) return "Not set";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not set";

  return date.toLocaleString();
}

function formatPercent(value: number) {
  return `${Number(value || 0).toFixed(1)}%`;
}

export default function AdminReportsPage() {
  const router = useRouter();

  const [isAdmin, setIsAdmin] = useState(false);

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [tournamentPlayers, setTournamentPlayers] = useState<TournamentPlayer[]>(
    []
  );
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [supportRequests, setSupportRequests] = useState<SupportRequest[]>([]);
  const [topPlayers, setTopPlayers] = useState<LeaderboardPlayer[]>([]);

  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const loadReports = useCallback(async () => {
    setCheckingAdmin(true);
    setLoading(true);
    setMessage("");

    const adminCheck = await checkIsAdmin();

    if (!adminCheck.user) {
      setCheckingAdmin(false);
      setLoading(false);
      router.push("/login");
      return;
    }

    if (!adminCheck.isAdmin) {
      setCheckingAdmin(false);
      setLoading(false);
      router.push("/tournaments");
      return;
    }

    setIsAdmin(true);
    setCheckingAdmin(false);

    const { data: tournamentData, error: tournamentError } = await supabase
      .from("tournaments")
      .select("id, name, game, platform, registration_open, created_at")
      .order("created_at", { ascending: false });

    if (tournamentError) {
      setMessage(`Error loading tournaments: ${tournamentError.message}`);
      setTournaments([]);
    } else {
      setTournaments((tournamentData || []) as Tournament[]);
    }

    const { data: playerData, error: playerError } = await supabase
      .from("tournament_players")
      .select("tournament_id, player_id");

    if (playerError) {
      setTournamentPlayers([]);
    } else {
      setTournamentPlayers((playerData || []) as TournamentPlayer[]);
    }

    const { data: matchData, error: matchError } = await supabase
      .from("matches")
      .select("id, tournament_id, status, winner_id, score_submitted_by, created_at")
      .order("created_at", { ascending: false });

    if (matchError) {
      setMatches([]);
    } else {
      setMatches((matchData || []) as MatchRow[]);
    }

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id, gamer_tag, platform, is_admin, created_at")
      .order("created_at", { ascending: false });

    if (profileError) {
      setProfiles([]);
    } else {
      setProfiles((profileData || []) as Profile[]);
    }

    const { data: supportData, error: supportError } = await supabase
      .from("support_requests")
      .select("id, status, category, created_at")
      .order("created_at", { ascending: false });

    if (supportError) {
      setSupportRequests([]);
    } else {
      setSupportRequests((supportData || []) as SupportRequest[]);
    }

    const { data: leaderboardData, error: leaderboardError } = await supabase
      .from("player_leaderboard")
      .select("id, gamer_tag, platform, wins, losses, win_percentage, tournaments_won")
      .order("wins", { ascending: false })
      .limit(5);

    if (leaderboardError) {
      setTopPlayers([]);
    } else {
      setTopPlayers((leaderboardData || []) as LeaderboardPlayer[]);
    }

    setLoading(false);
  }, [router]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadReports();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadReports]);

  const openTournaments = useMemo(() => {
    return tournaments.filter((tournament) => tournament.registration_open);
  }, [tournaments]);

  const closedTournaments = useMemo(() => {
    return tournaments.filter((tournament) => !tournament.registration_open);
  }, [tournaments]);

  const completedMatches = useMemo(() => {
    return matches.filter((match) => match.status === "completed");
  }, [matches]);

  const pendingMatches = useMemo(() => {
    return matches.filter((match) => match.status !== "completed");
  }, [matches]);

  const submittedScores = useMemo(() => {
    return matches.filter(
      (match) => match.score_submitted_by && match.status !== "completed"
    );
  }, [matches]);

  const adminCount = useMemo(() => {
    return profiles.filter((profile) => profile.is_admin).length;
  }, [profiles]);

  const regularPlayerCount = useMemo(() => {
    return profiles.filter((profile) => !profile.is_admin).length;
  }, [profiles]);

  const uniqueRegisteredPlayers = useMemo(() => {
    return new Set(tournamentPlayers.map((row) => row.player_id)).size;
  }, [tournamentPlayers]);

  const openSupportRequests = useMemo(() => {
    return supportRequests.filter((request) => request.status === "open");
  }, [supportRequests]);

  const inProgressSupportRequests = useMemo(() => {
    return supportRequests.filter((request) => request.status === "in_progress");
  }, [supportRequests]);

  const closedSupportRequests = useMemo(() => {
    return supportRequests.filter((request) => request.status === "closed");
  }, [supportRequests]);

  const platforms = useMemo(() => {
    const platformCounts = profiles.reduce((acc, profile) => {
      const platform = profile.platform?.trim() || "Not Set";
      acc[platform] = (acc[platform] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(platformCounts).sort((a, b) => b[1] - a[1]);
  }, [profiles]);

  const games = useMemo(() => {
    const gameCounts = tournaments.reduce((acc, tournament) => {
      const game = tournament.game?.trim() || "Not Set";
      acc[game] = (acc[game] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(gameCounts).sort((a, b) => b[1] - a[1]);
  }, [tournaments]);

  const latestTournament = useMemo(() => {
    return tournaments[0] || null;
  }, [tournaments]);

  const latestSupportRequest = useMemo(() => {
    return supportRequests[0] || null;
  }, [supportRequests]);

  const matchCompletionRate = useMemo(() => {
    if (matches.length === 0) return 0;

    return (completedMatches.length / matches.length) * 100;
  }, [completedMatches.length, matches.length]);

  function playerName(player: LeaderboardPlayer) {
    return player.gamer_tag || "Unnamed Player";
  }

  if (checkingAdmin || loading) {
    return (
      <main className="min-h-screen bg-black p-6 text-white">
        <div className="mx-auto max-w-6xl">
          <p className="rounded-xl border border-gray-800 bg-gray-950 p-6 text-gray-400">
            {checkingAdmin ? "Checking admin access..." : "Loading reports..."}
          </p>
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-black p-6 text-white">
        <div className="mx-auto max-w-6xl">
          <p className="rounded-xl border border-red-900 bg-red-950/40 p-6 text-red-200">
            You do not have admin access.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black p-6 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Link href="/admin" className="text-sm text-gray-400 hover:text-white">
            ← Back to Admin
          </Link>

          <Link
            href="/admin/support"
            className="text-sm text-gray-400 hover:text-white"
          >
            Support Inbox →
          </Link>
        </div>

        <section className="mb-8 rounded-2xl border border-gray-800 bg-gray-950 p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="mb-3 text-sm font-bold uppercase tracking-[0.25em] text-red-500">
                Admin Tools
              </p>

              <h1 className="mb-3 text-4xl font-black">Reports</h1>

              <p className="max-w-2xl text-gray-400">
                Review BattleGrid activity across tournaments, players, matches,
                support requests, and leaderboard performance.
              </p>
            </div>

            <button
              type="button"
              onClick={loadReports}
              disabled={loading}
              className="rounded-lg bg-white px-5 py-3 font-bold text-black hover:bg-gray-200 disabled:opacity-50"
            >
              {loading ? "Refreshing..." : "Refresh Reports"}
            </button>
          </div>
        </section>

        {message && (
          <p className="mb-6 rounded-lg border border-yellow-800 bg-yellow-950/30 p-4 text-sm text-yellow-200">
            {message}
          </p>
        )}

        <section className="mb-8 grid gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-gray-800 bg-gray-950 p-5">
            <p className="text-sm text-gray-500">Tournaments</p>
            <p className="mt-2 text-4xl font-black">{tournaments.length}</p>
            <p className="mt-2 text-xs text-gray-500">
              {openTournaments.length} open / {closedTournaments.length} closed
            </p>
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-950 p-5">
            <p className="text-sm text-gray-500">Accounts</p>
            <p className="mt-2 text-4xl font-black">{profiles.length}</p>
            <p className="mt-2 text-xs text-gray-500">
              {regularPlayerCount} players / {adminCount} admins
            </p>
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-950 p-5">
            <p className="text-sm text-gray-500">Match Entries</p>
            <p className="mt-2 text-4xl font-black">{matches.length}</p>
            <p className="mt-2 text-xs text-gray-500">
              {formatPercent(matchCompletionRate)} completed
            </p>
          </div>

          <div className="rounded-xl border border-red-800 bg-red-950/20 p-5">
            <p className="text-sm text-red-300">Open Support</p>
            <p className="mt-2 text-4xl font-black">
              {openSupportRequests.length}
            </p>
            <p className="mt-2 text-xs text-red-200">
              {inProgressSupportRequests.length} in progress
            </p>
          </div>
        </section>

        <section className="mb-8 grid gap-4 md:grid-cols-4">
          <Link
            href="/admin/tournaments"
            className="rounded-xl border border-gray-800 bg-gray-950 p-5 hover:border-red-700 hover:bg-red-950/20"
          >
            <p className="text-sm text-gray-500">Registered Entries</p>
            <p className="mt-2 text-4xl font-black">
              {tournamentPlayers.length}
            </p>
            <p className="mt-2 text-xs text-gray-500">
              {uniqueRegisteredPlayers} unique players
            </p>
          </Link>

          <Link
            href="/admin/reviews"
            className="rounded-xl border border-yellow-800 bg-yellow-950/20 p-5 hover:bg-yellow-950/30"
          >
            <p className="text-sm text-yellow-300">Scores Pending Review</p>
            <p className="mt-2 text-4xl font-black">{submittedScores.length}</p>
            <p className="mt-2 text-xs text-yellow-200">Open review queue</p>
          </Link>

          <Link
            href="/admin/support"
            className="rounded-xl border border-red-800 bg-red-950/20 p-5 hover:bg-red-950/30"
          >
            <p className="text-sm text-red-300">Support Requests</p>
            <p className="mt-2 text-4xl font-black">
              {supportRequests.length}
            </p>
            <p className="mt-2 text-xs text-red-200">
              {closedSupportRequests.length} closed
            </p>
          </Link>

          <Link
            href="/brackets"
            className="rounded-xl border border-gray-800 bg-gray-950 p-5 hover:border-red-700 hover:bg-red-950/20"
          >
            <p className="text-sm text-gray-500">Pending Matches</p>
            <p className="mt-2 text-4xl font-black">{pendingMatches.length}</p>
            <p className="mt-2 text-xs text-gray-500">Active or waiting</p>
          </Link>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_420px]">
          <div className="grid gap-6">
            <section className="rounded-xl border border-gray-800 bg-gray-950 p-6">
              <h2 className="mb-5 text-2xl font-bold">Top Players</h2>

              {topPlayers.length === 0 ? (
                <p className="rounded-lg border border-gray-800 bg-black p-4 text-gray-400">
                  Leaderboard stats will appear after matches are completed.
                </p>
              ) : (
                <div className="grid gap-3">
                  {topPlayers.map((player, index) => (
                    <Link
                      key={player.id}
                      href={`/players/${player.id}`}
                      className="rounded-xl border border-gray-800 bg-black p-4 hover:border-red-700 hover:bg-red-950/20"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="text-xl font-black">
                            #{index + 1} {playerName(player)}
                          </p>

                          <p className="mt-1 text-sm text-gray-500">
                            {player.platform || "Platform not set"}
                          </p>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3">
                          <div>
                            <p className="text-xs text-gray-500">Record</p>
                            <p className="font-black">
                              {player.wins}-{player.losses}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-gray-500">Win Rate</p>
                            <p className="font-black">
                              {formatPercent(player.win_percentage)}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-gray-500">
                              Tournament Wins
                            </p>
                            <p className="font-black">
                              {player.tournaments_won}
                            </p>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-xl border border-gray-800 bg-gray-950 p-6">
              <h2 className="mb-5 text-2xl font-bold">Popular Games</h2>

              {games.length === 0 ? (
                <p className="rounded-lg border border-gray-800 bg-black p-4 text-gray-400">
                  No tournament games found yet.
                </p>
              ) : (
                <div className="grid gap-3">
                  {games.slice(0, 8).map(([game, count]) => (
                    <div
                      key={game}
                      className="rounded-lg border border-gray-800 bg-black p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-bold">{game}</p>
                        <p className="text-sm text-gray-400">
                          {count} tournament(s)
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <aside className="grid h-fit gap-6">
            <section className="rounded-xl border border-gray-800 bg-gray-950 p-6">
              <h2 className="mb-5 text-2xl font-bold">Platform Breakdown</h2>

              {platforms.length === 0 ? (
                <p className="rounded-lg border border-gray-800 bg-black p-4 text-gray-400">
                  No player platforms found.
                </p>
              ) : (
                <div className="grid gap-3">
                  {platforms.slice(0, 8).map(([platform, count]) => (
                    <div
                      key={platform}
                      className="rounded-lg border border-gray-800 bg-black p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-bold">{platform}</p>
                        <p className="text-sm text-gray-400">
                          {count} account(s)
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-xl border border-gray-800 bg-gray-950 p-6">
              <h2 className="mb-5 text-2xl font-bold">Latest Activity</h2>

              <div className="grid gap-4">
                <div className="rounded-lg border border-gray-800 bg-black p-4">
                  <p className="text-sm text-gray-500">Latest Tournament</p>

                  <p className="mt-2 font-bold">
                    {latestTournament?.name || "None yet"}
                  </p>

                  <p className="mt-1 text-xs text-gray-600">
                    {latestTournament
                      ? formatDateTime(latestTournament.created_at)
                      : "No tournament activity"}
                  </p>
                </div>

                <div className="rounded-lg border border-gray-800 bg-black p-4">
                  <p className="text-sm text-gray-500">
                    Latest Support Request
                  </p>

                  <p className="mt-2 font-bold">
                    {latestSupportRequest
                      ? latestSupportRequest.category
                      : "None yet"}
                  </p>

                  <p className="mt-1 text-xs text-gray-600">
                    {latestSupportRequest
                      ? formatDateTime(latestSupportRequest.created_at)
                      : "No support activity"}
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-red-900 bg-red-950/20 p-6">
              <h2 className="mb-4 text-2xl font-bold text-red-200">
                Admin Shortcuts
              </h2>

              <div className="grid gap-3">
                <Link
                  href="/admin/tournaments"
                  className="rounded-lg bg-white px-5 py-3 text-center font-bold text-black hover:bg-gray-200"
                >
                  Manage Tournaments
                </Link>

                <Link
                  href="/admin/reviews"
                  className="rounded-lg border border-gray-700 px-5 py-3 text-center font-bold text-white hover:bg-gray-900"
                >
                  Score Reviews
                </Link>

                <Link
                  href="/admin/support"
                  className="rounded-lg border border-gray-700 px-5 py-3 text-center font-bold text-white hover:bg-gray-900"
                >
                  Support Inbox
                </Link>
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}