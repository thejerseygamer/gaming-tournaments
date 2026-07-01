"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../lib/supabase";

type PlayerProfile = {
  id: string;
  gamer_tag: string | null;
  platform: string | null;
  favorite_team: string | null;
  is_admin: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

type PlayerStats = {
  id: string;
  gamer_tag: string | null;
  platform: string | null;
  favorite_team: string | null;
  tournaments_joined: number;
  matches_played: number;
  wins: number;
  losses: number;
  tournaments_won: number;
  win_percentage: number;
  last_match_at: string | null;
};

type TournamentPlayer = {
  tournament_id: string;
  player_id: string;
};

type Tournament = {
  id: string;
  name: string;
  game: string | null;
  platform: string | null;
  prize_pool: number | null;
  entry_fee: number | null;
  start_time: string | null;
  registration_open: boolean;
  created_at: string;
};

type Match = {
  id: string;
  tournament_id: string;
  round: number;
  match_number: number;
  player1_id: string | null;
  player2_id: string | null;
  winner_id: string | null;
  status: string | null;
  player1_score: number | null;
  player2_score: number | null;
  score_submitted_by: string | null;
  created_at: string;
};

function formatDateTime(value: string | null) {
  if (!value) return "Not set";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not set";

  return date.toLocaleString();
}

function formatWinPercentage(value: number | null | undefined) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function buildProfileMap(profiles: PlayerProfile[]) {
  return profiles.reduce((acc, profile) => {
    acc[profile.id] = profile;
    return acc;
  }, {} as Record<string, PlayerProfile>);
}

function buildTournamentMap(tournaments: Tournament[]) {
  return tournaments.reduce((acc, tournament) => {
    acc[tournament.id] = tournament;
    return acc;
  }, {} as Record<string, Tournament>);
}

export default function PublicPlayerProfilePage() {
  const params = useParams();

  const playerId = typeof params.id === "string" ? params.id : "";

  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [joinedRows, setJoinedRows] = useState<TournamentPlayer[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [profilesById, setProfilesById] = useState<
    Record<string, PlayerProfile>
  >({});

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const loadPlayerProfile = useCallback(async () => {
    setLoading(true);
    setMessage("");

    if (!playerId) {
      setProfile(null);
      setStats(null);
      setJoinedRows([]);
      setTournaments([]);
      setMatches([]);
      setProfilesById({});
      setMessage("Player not found.");
      setLoading(false);
      return;
    }

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id, gamer_tag, platform, favorite_team, is_admin, created_at, updated_at")
      .eq("id", playerId)
      .maybeSingle();

    if (profileError) {
      setMessage(`Error loading player profile: ${profileError.message}`);
      setProfile(null);
      setStats(null);
      setJoinedRows([]);
      setTournaments([]);
      setMatches([]);
      setProfilesById({});
      setLoading(false);
      return;
    }

    if (!profileData) {
      setMessage("Player not found.");
      setProfile(null);
      setStats(null);
      setJoinedRows([]);
      setTournaments([]);
      setMatches([]);
      setProfilesById({});
      setLoading(false);
      return;
    }

    const loadedProfile = profileData as PlayerProfile;

    setProfile(loadedProfile);

    const { data: statsData, error: statsError } = await supabase
      .from("player_stats")
      .select(
        "id, gamer_tag, platform, favorite_team, tournaments_joined, matches_played, wins, losses, tournaments_won, win_percentage, last_match_at"
      )
      .eq("id", playerId)
      .maybeSingle();

    if (statsError) {
      setStats(null);
    } else {
      setStats((statsData || null) as PlayerStats | null);
    }

    const { data: joinedData, error: joinedError } = await supabase
      .from("tournament_players")
      .select("tournament_id, player_id")
      .eq("player_id", playerId);

    if (joinedError) {
      setMessage(`Error loading joined tournaments: ${joinedError.message}`);
      setJoinedRows([]);
      setTournaments([]);
    }

    const loadedJoinedRows = (joinedData || []) as TournamentPlayer[];
    const tournamentIds = loadedJoinedRows.map((row) => row.tournament_id);

    setJoinedRows(loadedJoinedRows);

    if (tournamentIds.length > 0) {
      const { data: tournamentData, error: tournamentError } = await supabase
        .from("tournaments")
        .select(
          "id, name, game, platform, prize_pool, entry_fee, start_time, registration_open, created_at"
        )
        .in("id", tournamentIds)
        .order("created_at", { ascending: false });

      if (tournamentError) {
        setMessage(`Error loading tournaments: ${tournamentError.message}`);
        setTournaments([]);
      } else {
        setTournaments((tournamentData || []) as Tournament[]);
      }
    } else {
      setTournaments([]);
    }

    const { data: matchData, error: matchError } = await supabase
      .from("matches")
      .select(
        "id, tournament_id, round, match_number, player1_id, player2_id, winner_id, status, player1_score, player2_score, score_submitted_by, created_at"
      )
      .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`)
      .order("created_at", { ascending: false });

    if (matchError) {
      setMessage(`Error loading recent matches: ${matchError.message}`);
      setMatches([]);
      setProfilesById({});
      setLoading(false);
      return;
    }

    const loadedMatches = (matchData || []) as Match[];

    setMatches(loadedMatches);

    const profileIds = Array.from(
      new Set(
        loadedMatches
          .flatMap((match) => [
            match.player1_id,
            match.player2_id,
            match.winner_id,
            match.score_submitted_by,
          ])
          .filter((id): id is string => Boolean(id))
      )
    );

    if (!profileIds.includes(playerId)) {
      profileIds.push(playerId);
    }

    if (profileIds.length > 0) {
      const { data: profileRows, error: profileRowsError } = await supabase
        .from("profiles")
        .select("id, gamer_tag, platform, favorite_team, is_admin, created_at, updated_at")
        .in("id", profileIds);

      if (profileRowsError) {
        setProfilesById({});
      } else {
        setProfilesById(buildProfileMap((profileRows || []) as PlayerProfile[]));
      }
    } else {
      setProfilesById({});
    }

    setLoading(false);
  }, [playerId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadPlayerProfile();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadPlayerProfile]);

  const tournamentsById = useMemo(() => {
    return buildTournamentMap(tournaments);
  }, [tournaments]);

  const completedMatches = useMemo(() => {
    return matches.filter((match) => match.status === "completed");
  }, [matches]);

  const pendingMatches = useMemo(() => {
    return matches.filter((match) => match.status !== "completed");
  }, [matches]);

  const wins = useMemo(() => {
    return completedMatches.filter((match) => match.winner_id === playerId)
      .length;
  }, [completedMatches, playerId]);

  const losses = useMemo(() => {
    return completedMatches.filter((match) => match.winner_id !== playerId)
      .length;
  }, [completedMatches, playerId]);

  const recentMatches = useMemo(() => {
    return matches.slice(0, 8);
  }, [matches]);

  function playerName(id: string | null) {
    if (!id) return "TBD";

    return profilesById[id]?.gamer_tag || "Unnamed Player";
  }

  function profileName() {
    return profile?.gamer_tag || "Unnamed Player";
  }

  function opponentName(match: Match) {
    if (match.player1_id === playerId) return playerName(match.player2_id);
    if (match.player2_id === playerId) return playerName(match.player1_id);

    return "TBD";
  }

  function matchResultLabel(match: Match) {
    if (match.status !== "completed") {
      if (match.score_submitted_by) return "Pending Review";
      return "Pending";
    }

    if (match.winner_id === playerId) return "Win";

    return "Loss";
  }

  function matchResultClass(match: Match) {
    if (match.status !== "completed") {
      if (match.score_submitted_by) {
        return "border-yellow-700 bg-yellow-950/40 text-yellow-300";
      }

      return "border-gray-700 bg-black text-gray-300";
    }

    if (match.winner_id === playerId) {
      return "border-green-700 bg-green-950/40 text-green-300";
    }

    return "border-red-700 bg-red-950/40 text-red-300";
  }

  function scoreText(match: Match) {
    if (
      match.player1_score === null ||
      match.player1_score === undefined ||
      match.player2_score === null ||
      match.player2_score === undefined
    ) {
      return "No score";
    }

    return `${match.player1_score} - ${match.player2_score}`;
  }

  function tournamentName(tournamentId: string) {
    return tournamentsById[tournamentId]?.name || "Unknown Tournament";
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black p-6 text-white">
        <div className="mx-auto max-w-6xl">
          <p className="rounded-xl border border-gray-800 bg-gray-950 p-6 text-gray-400">
            Loading player profile...
          </p>
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="min-h-screen bg-black p-6 text-white">
        <div className="mx-auto max-w-6xl">
          <section className="rounded-xl border border-red-900 bg-red-950/40 p-6">
            <h1 className="mb-2 text-3xl font-black">Player Not Found</h1>

            <p className="mb-5 text-red-200">
              {message || "This player profile could not be loaded."}
            </p>

            <Link
              href="/leaderboard"
              className="inline-block rounded-lg bg-white px-5 py-3 font-bold text-black hover:bg-gray-200"
            >
              Back to Leaderboard
            </Link>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black p-6 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Link
            href="/leaderboard"
            className="text-sm text-gray-400 hover:text-white"
          >
            ← Back to Leaderboard
          </Link>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/tournaments"
              className="text-sm text-gray-400 hover:text-white"
            >
              Browse Tournaments →
            </Link>

            <Link href="/brackets" className="text-sm text-gray-400 hover:text-white">
              Brackets →
            </Link>
          </div>
        </div>

        {message && (
          <p className="mb-6 rounded-lg border border-yellow-800 bg-yellow-950/30 p-4 text-sm text-yellow-200">
            {message}
          </p>
        )}

        <section className="mb-8 rounded-2xl border border-gray-800 bg-gray-950 p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="mb-3 text-sm font-bold uppercase tracking-[0.25em] text-red-500">
                BattleGrid Player
              </p>

              <h1 className="mb-3 text-5xl font-black">{profileName()}</h1>

              <p className="text-gray-400">
                {profile.platform || "Platform not set"} •{" "}
                {profile.favorite_team || "Favorite team not set"}
              </p>

              {profile.is_admin && (
                <span className="mt-4 inline-block rounded-full border border-red-700 bg-red-950/40 px-3 py-1 text-xs font-bold text-red-300">
                  Admin
                </span>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-gray-800 bg-black p-4">
                <p className="text-sm text-gray-500">Record</p>
                <p className="mt-2 text-3xl font-black">
                  {stats?.wins ?? wins}-{stats?.losses ?? losses}
                </p>
              </div>

              <div className="rounded-xl border border-gray-800 bg-black p-4">
                <p className="text-sm text-gray-500">Win Rate</p>
                <p className="mt-2 text-3xl font-black">
                  {formatWinPercentage(stats?.win_percentage)}
                </p>
              </div>

              <div className="rounded-xl border border-gray-800 bg-black p-4">
                <p className="text-sm text-gray-500">Tournament Wins</p>
                <p className="mt-2 text-3xl font-black">
                  {stats?.tournaments_won || 0}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-8 grid gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-gray-800 bg-gray-950 p-5">
            <p className="text-sm text-gray-500">Tournaments Joined</p>
            <p className="mt-2 text-4xl font-black">
              {stats?.tournaments_joined ?? joinedRows.length}
            </p>
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-950 p-5">
            <p className="text-sm text-gray-500">Matches Played</p>
            <p className="mt-2 text-4xl font-black">
              {stats?.matches_played ?? completedMatches.length}
            </p>
          </div>

          <div className="rounded-xl border border-green-800 bg-green-950/20 p-5">
            <p className="text-sm text-green-300">Wins</p>
            <p className="mt-2 text-4xl font-black">{stats?.wins ?? wins}</p>
          </div>

          <div className="rounded-xl border border-red-800 bg-red-950/20 p-5">
            <p className="text-sm text-red-300">Losses</p>
            <p className="mt-2 text-4xl font-black">{stats?.losses ?? losses}</p>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_420px]">
          <div className="grid gap-6">
            <section className="rounded-xl border border-gray-800 bg-gray-950 p-6">
              <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Recent Matches</h2>

                  <p className="mt-1 text-sm text-gray-400">
                    Latest matches involving this player.
                  </p>
                </div>

                <span className="w-fit rounded-full border border-gray-700 bg-black px-3 py-1 text-xs font-bold text-gray-300">
                  {matches.length} total
                </span>
              </div>

              {recentMatches.length === 0 ? (
                <p className="rounded-lg border border-gray-800 bg-black p-4 text-gray-400">
                  This player does not have any matches yet.
                </p>
              ) : (
                <div className="grid gap-4">
                  {recentMatches.map((match) => (
                    <article
                      key={match.id}
                      className="rounded-xl border border-gray-800 bg-black p-4"
                    >
                      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <h3 className="text-xl font-bold">
                            {tournamentName(match.tournament_id)}
                          </h3>

                          <p className="mt-1 text-sm text-gray-500">
                            Round {match.round}, Match {match.match_number} •
                            Opponent: {opponentName(match)}
                          </p>
                        </div>

                        <span
                          className={`w-fit rounded-full border px-3 py-1 text-xs font-bold ${matchResultClass(
                            match
                          )}`}
                        >
                          {matchResultLabel(match)}
                        </span>
                      </div>

                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="rounded-lg border border-gray-800 bg-gray-950 p-3">
                          <p className="text-xs text-gray-500">Player 1</p>
                          <p className="mt-1 font-bold">
                            {playerName(match.player1_id)}
                          </p>
                        </div>

                        <div className="rounded-lg border border-gray-800 bg-gray-950 p-3">
                          <p className="text-xs text-gray-500">Player 2</p>
                          <p className="mt-1 font-bold">
                            {playerName(match.player2_id)}
                          </p>
                        </div>

                        <div className="rounded-lg border border-gray-800 bg-gray-950 p-3">
                          <p className="text-xs text-gray-500">Score</p>
                          <p className="mt-1 font-bold">{scoreText(match)}</p>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                        <Link
                          href={`/brackets?tournament=${match.tournament_id}`}
                          className="rounded-lg border border-gray-700 px-4 py-3 text-center text-sm font-bold text-white hover:bg-gray-900"
                        >
                          View Bracket
                        </Link>

                        <Link
                          href={`/tournaments/${match.tournament_id}`}
                          className="rounded-lg bg-white px-4 py-3 text-center text-sm font-bold text-black hover:bg-gray-200"
                        >
                          Tournament
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>

          <aside className="grid h-fit gap-6">
            <section className="rounded-xl border border-gray-800 bg-gray-950 p-6">
              <h2 className="mb-4 text-2xl font-bold">Player Info</h2>

              <div className="grid gap-3 text-sm text-gray-300">
                <p>
                  <span className="text-gray-500">Gamer Tag:</span>{" "}
                  {profile.gamer_tag || "Not set"}
                </p>

                <p>
                  <span className="text-gray-500">Platform:</span>{" "}
                  {profile.platform || "Not set"}
                </p>

                <p>
                  <span className="text-gray-500">Favorite Team:</span>{" "}
                  {profile.favorite_team || "Not set"}
                </p>

                <p>
                  <span className="text-gray-500">Joined BattleGrid:</span>{" "}
                  {formatDateTime(profile.created_at)}
                </p>

                <p>
                  <span className="text-gray-500">Last Match:</span>{" "}
                  {formatDateTime(stats?.last_match_at || null)}
                </p>
              </div>
            </section>

            <section className="rounded-xl border border-gray-800 bg-gray-950 p-6">
              <h2 className="mb-4 text-2xl font-bold">Joined Tournaments</h2>

              {tournaments.length === 0 ? (
                <p className="rounded-lg border border-gray-800 bg-black p-4 text-sm text-gray-400">
                  This player has not joined any tournaments yet.
                </p>
              ) : (
                <div className="grid gap-3">
                  {tournaments.slice(0, 8).map((tournament) => (
                    <Link
                      key={tournament.id}
                      href={`/tournaments/${tournament.id}`}
                      className="rounded-lg border border-gray-800 bg-black p-4 hover:border-red-700 hover:bg-red-950/20"
                    >
                      <p className="font-bold">{tournament.name}</p>

                      <p className="mt-1 text-xs text-gray-500">
                        {tournament.game || "Game not set"} •{" "}
                        {tournament.platform || "Platform not set"}
                      </p>

                      <p className="mt-2 text-xs text-gray-600">
                        Start: {formatDateTime(tournament.start_time)}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-xl border border-gray-800 bg-gray-950 p-6">
              <h2 className="mb-4 text-2xl font-bold">Match Status</h2>

              <div className="grid gap-3">
                <div className="rounded-lg border border-gray-800 bg-black p-4">
                  <p className="text-sm text-gray-500">Completed</p>
                  <p className="mt-1 text-3xl font-black">
                    {completedMatches.length}
                  </p>
                </div>

                <div className="rounded-lg border border-gray-800 bg-black p-4">
                  <p className="text-sm text-gray-500">Pending / Active</p>
                  <p className="mt-1 text-3xl font-black">
                    {pendingMatches.length}
                  </p>
                </div>
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}