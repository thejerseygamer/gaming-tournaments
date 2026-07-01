"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { checkIsAdmin } from "../../lib/admin";

type Tournament = {
  id: string;
  name: string;
  game: string | null;
  platform: string | null;
  description: string | null;
  rules: string | null;
  start_time: string | null;
  prize_pool: number | null;
  entry_fee: number | null;
  max_players: number | null;
  registration_open: boolean;
  created_at: string;
};

type TournamentPlayer = {
  tournament_id: string;
  player_id: string;
};

type PlayerProfile = {
  id: string;
  gamer_tag: string | null;
  platform: string | null;
  favorite_team: string | null;
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

function buildProfileMap(profiles: PlayerProfile[]) {
  return profiles.reduce((acc, profile) => {
    acc[profile.id] = profile;
    return acc;
  }, {} as Record<string, PlayerProfile>);
}

export default function TournamentDetailsPage() {
  const params = useParams();
  const router = useRouter();

  const tournamentId = typeof params.id === "string" ? params.id : "";

  const [userId, setUserId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [playerRows, setPlayerRows] = useState<TournamentPlayer[]>([]);
  const [profilesById, setProfilesById] = useState<
    Record<string, PlayerProfile>
  >({});
  const [matches, setMatches] = useState<Match[]>([]);

  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [message, setMessage] = useState("");

  const loadTournamentDetails = useCallback(async () => {
    setLoading(true);
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    setUserId(user?.id || "");

    const adminCheck = await checkIsAdmin();
    setIsAdmin(Boolean(adminCheck.isAdmin));

    if (!tournamentId) {
      setTournament(null);
      setPlayerRows([]);
      setProfilesById({});
      setMatches([]);
      setMessage("Tournament not found.");
      setLoading(false);
      return;
    }

    const { data: tournamentData, error: tournamentError } = await supabase
      .from("tournaments")
      .select(
        "id, name, game, platform, description, rules, start_time, prize_pool, entry_fee, max_players, registration_open, created_at"
      )
      .eq("id", tournamentId)
      .maybeSingle();

    if (tournamentError) {
      setMessage(`Error loading tournament: ${tournamentError.message}`);
      setTournament(null);
      setPlayerRows([]);
      setProfilesById({});
      setMatches([]);
      setLoading(false);
      return;
    }

    if (!tournamentData) {
      setMessage("Tournament not found.");
      setTournament(null);
      setPlayerRows([]);
      setProfilesById({});
      setMatches([]);
      setLoading(false);
      return;
    }

    const loadedTournament = tournamentData as Tournament;

    setTournament(loadedTournament);

    const { data: playerData, error: playerError } = await supabase
      .from("tournament_players")
      .select("tournament_id, player_id")
      .eq("tournament_id", tournamentId);

    if (playerError) {
      setMessage(`Error loading registered players: ${playerError.message}`);
      setPlayerRows([]);
    }

    const loadedPlayerRows = (playerData || []) as TournamentPlayer[];

    setPlayerRows(loadedPlayerRows);

    const { data: matchData, error: matchError } = await supabase
      .from("matches")
      .select(
        "id, tournament_id, round, match_number, player1_id, player2_id, winner_id, status, player1_score, player2_score, score_submitted_by, created_at"
      )
      .eq("tournament_id", tournamentId)
      .order("round", { ascending: true })
      .order("match_number", { ascending: true });

    if (matchError) {
      setMessage(`Error loading bracket: ${matchError.message}`);
      setMatches([]);
    }

    const loadedMatches = (matchData || []) as Match[];

    setMatches(loadedMatches);

    const profileIds = Array.from(
      new Set(
        [
          ...loadedPlayerRows.map((row) => row.player_id),
          ...loadedMatches.flatMap((match) => [
            match.player1_id,
            match.player2_id,
            match.winner_id,
            match.score_submitted_by,
          ]),
        ].filter((id): id is string => Boolean(id))
      )
    );

    if (profileIds.length > 0) {
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, gamer_tag, platform, favorite_team")
        .in("id", profileIds);

      if (profileError) {
        setMessage(`Error loading player profiles: ${profileError.message}`);
        setProfilesById({});
      } else {
        setProfilesById(buildProfileMap((profileData || []) as PlayerProfile[]));
      }
    } else {
      setProfilesById({});
    }

    setLoading(false);
  }, [tournamentId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadTournamentDetails();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadTournamentDetails]);

  const registeredPlayers = useMemo(() => {
    return playerRows
      .map((row) => {
        return {
          row,
          profile: profilesById[row.player_id] || null,
        };
      })
      .sort((a, b) => {
        const aName = a.profile?.gamer_tag || "Unnamed Player";
        const bName = b.profile?.gamer_tag || "Unnamed Player";

        return aName.localeCompare(bName);
      });
  }, [playerRows, profilesById]);

  const playerCount = useMemo(() => {
    return playerRows.length;
  }, [playerRows]);

  const userJoined = useMemo(() => {
    if (!userId) return false;

    return playerRows.some((row) => row.player_id === userId);
  }, [playerRows, userId]);

  const bracketGenerated = useMemo(() => {
    return matches.length > 0;
  }, [matches]);

  const completedMatches = useMemo(() => {
    return matches.filter((match) => match.status === "completed").length;
  }, [matches]);

  const pendingReviewMatches = useMemo(() => {
    return matches.filter(
      (match) => match.status === "pending" && match.score_submitted_by
    ).length;
  }, [matches]);

  function playerName(playerId: string | null) {
    if (!playerId) return "TBD";

    return profilesById[playerId]?.gamer_tag || "Unnamed Player";
  }

  function isFull() {
    if (!tournament?.max_players) return false;

    return playerCount >= tournament.max_players;
  }

  function canJoin() {
    if (!tournament) return false;
    if (!userId) return false;
    if (userJoined) return false;
    if (bracketGenerated) return false;
    if (!tournament.registration_open) return false;
    if (isFull()) return false;

    return true;
  }

  function registrationStatusLabel() {
    if (!tournament) return "Unavailable";
    if (bracketGenerated) return "Bracket Locked";
    if (isFull()) return "Tournament Full";
    if (!tournament.registration_open) return "Registration Closed";

    return "Registration Open";
  }

  function registrationStatusClass() {
    if (bracketGenerated) {
      return "border-yellow-700 bg-yellow-950/40 text-yellow-300";
    }

    if (isFull() || !tournament?.registration_open) {
      return "border-red-700 bg-red-950/40 text-red-300";
    }

    return "border-green-700 bg-green-950/40 text-green-300";
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

  async function joinTournament() {
    if (!tournament) return;

    if (!userId) {
      router.push("/login");
      return;
    }

    if (!canJoin()) {
      setMessage("You cannot join this tournament right now.");
      return;
    }

    setJoining(true);
    setMessage("");

    const { error } = await supabase.from("tournament_players").insert({
      tournament_id: tournament.id,
      player_id: userId,
    });

    if (error) {
      setMessage(`Error joining tournament: ${error.message}`);
      setJoining(false);
      return;
    }

    setMessage(`You joined "${tournament.name}".`);
    await loadTournamentDetails();
    setJoining(false);
  }

  async function leaveTournament() {
    if (!tournament) return;

    if (!userId) {
      router.push("/login");
      return;
    }

    if (!userJoined) {
      setMessage("You have not joined this tournament.");
      return;
    }

    if (bracketGenerated) {
      setMessage(
        "You cannot leave after the bracket has been generated. Contact an admin if you need help."
      );
      return;
    }

    const confirmed = window.confirm(`Leave "${tournament.name}"?`);

    if (!confirmed) return;

    setLeaving(true);
    setMessage("");

    const { error } = await supabase
      .from("tournament_players")
      .delete()
      .eq("tournament_id", tournament.id)
      .eq("player_id", userId);

    if (error) {
      setMessage(`Error leaving tournament: ${error.message}`);
      setLeaving(false);
      return;
    }

    setMessage(`You left "${tournament.name}".`);
    await loadTournamentDetails();
    setLeaving(false);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black p-6 text-white">
        <div className="mx-auto max-w-6xl">
          <p className="rounded-xl border border-gray-800 bg-gray-950 p-6 text-gray-400">
            Loading tournament...
          </p>
        </div>
      </main>
    );
  }

  if (!tournament) {
    return (
      <main className="min-h-screen bg-black p-6 text-white">
        <div className="mx-auto max-w-6xl">
          <section className="rounded-xl border border-red-900 bg-red-950/40 p-6">
            <h1 className="mb-2 text-3xl font-black">Tournament Not Found</h1>

            <p className="mb-5 text-red-200">
              {message || "This tournament could not be loaded."}
            </p>

            <Link
              href="/tournaments"
              className="inline-block rounded-lg bg-white px-5 py-3 font-bold text-black hover:bg-gray-200"
            >
              Back to Tournaments
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
            href="/tournaments"
            className="text-sm text-gray-400 hover:text-white"
          >
            ← Back to Tournaments
          </Link>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href={`/brackets?tournament=${tournament.id}`}
              className="text-sm text-gray-400 hover:text-white"
            >
              View Bracket →
            </Link>

            {userJoined && (
              <Link
                href="/my-tournaments"
                className="text-sm text-gray-400 hover:text-white"
              >
                My Tournaments →
              </Link>
            )}

            {isAdmin && (
              <Link
                href={`/admin/tournaments/${tournament.id}`}
                className="text-sm text-red-400 hover:text-red-300"
              >
                Admin Edit →
              </Link>
            )}
          </div>
        </div>

        <section className="mb-8 rounded-2xl border border-gray-800 bg-gray-950 p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="mb-3 text-sm font-bold uppercase tracking-[0.25em] text-red-500">
                BattleGrid Tournament
              </p>

              <h1 className="mb-3 text-5xl font-black">{tournament.name}</h1>

              <p className="text-gray-400">
                {tournament.game || "Game not set"} •{" "}
                {tournament.platform || "Platform not set"}
              </p>
            </div>

            <span
              className={`w-fit rounded-full border px-4 py-2 text-sm font-bold ${registrationStatusClass()}`}
            >
              {registrationStatusLabel()}
            </span>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-gray-800 bg-black p-4">
              <p className="text-sm text-gray-500">Players</p>
              <p className="mt-2 text-3xl font-black">
                {playerCount}/{tournament.max_players || "∞"}
              </p>
            </div>

            <div className="rounded-xl border border-gray-800 bg-black p-4">
              <p className="text-sm text-gray-500">Prize Pool</p>
              <p className="mt-2 text-3xl font-black">
                ${tournament.prize_pool || 0}
              </p>
            </div>

            <div className="rounded-xl border border-gray-800 bg-black p-4">
              <p className="text-sm text-gray-500">Entry Fee</p>
              <p className="mt-2 text-3xl font-black">
                ${tournament.entry_fee || 0}
              </p>
            </div>

            <div className="rounded-xl border border-gray-800 bg-black p-4">
              <p className="text-sm text-gray-500">Matches</p>
              <p className="mt-2 text-3xl font-black">{matches.length}</p>
            </div>
          </div>
        </section>

        {message && (
          <p className="mb-6 rounded-lg border border-yellow-800 bg-yellow-950/30 p-4 text-sm text-yellow-200">
            {message}
          </p>
        )}

        <section className="mb-8 grid gap-6 lg:grid-cols-[1fr_420px]">
          <div className="grid gap-6">
            <section className="rounded-xl border border-gray-800 bg-gray-950 p-6">
              <h2 className="mb-4 text-2xl font-bold">Tournament Details</h2>

              <div className="grid gap-4 text-sm text-gray-300">
                <p>
                  <span className="text-gray-500">Start Time:</span>{" "}
                  {formatDateTime(tournament.start_time)}
                </p>

                <p>
                  <span className="text-gray-500">Created:</span>{" "}
                  {formatDateTime(tournament.created_at)}
                </p>
              </div>

              <div className="mt-6">
                <h3 className="mb-2 text-lg font-bold">Description</h3>

                <p className="whitespace-pre-wrap text-gray-400">
                  {tournament.description ||
                    "No description has been added for this tournament yet."}
                </p>
              </div>

              <div className="mt-6">
                <h3 className="mb-2 text-lg font-bold">Rules</h3>

                <p className="whitespace-pre-wrap text-gray-400">
                  {tournament.rules ||
                    "No rules have been added for this tournament yet."}
                </p>
              </div>
            </section>

            <section className="rounded-xl border border-gray-800 bg-gray-950 p-6">
              <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Registered Players</h2>

                  <p className="mt-1 text-sm text-gray-400">
                    Players currently signed up for this tournament.
                  </p>
                </div>

                <span className="w-fit rounded-full border border-gray-700 bg-black px-3 py-1 text-xs font-bold text-gray-300">
                  {playerCount} registered
                </span>
              </div>

              {registeredPlayers.length === 0 ? (
                <p className="rounded-lg border border-gray-800 bg-black p-4 text-gray-400">
                  No players have joined this tournament yet.
                </p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {registeredPlayers.map(({ row, profile }, index) => (
                    <Link
                      key={row.player_id}
                      href={`/players/${row.player_id}`}
                      className="rounded-xl border border-gray-800 bg-black p-4 hover:border-red-700 hover:bg-red-950/20"
                    >
                      <p className="font-bold">
                        {index + 1}. {profile?.gamer_tag || "Unnamed Player"}
                      </p>

                      <p className="mt-1 text-sm text-gray-500">
                        {profile?.platform || "Platform not set"} •{" "}
                        {profile?.favorite_team || "Favorite team not set"}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>

          <aside className="grid h-fit gap-6">
            <section className="rounded-xl border border-gray-800 bg-gray-950 p-6">
              <h2 className="mb-4 text-2xl font-bold">Registration</h2>

              {!userId ? (
                <>
                  <p className="mb-5 text-sm text-gray-400">
                    Log in or create an account to join this tournament.
                  </p>

                  <div className="grid gap-3">
                    <Link
                      href="/login"
                      className="rounded-lg bg-white px-5 py-3 text-center font-bold text-black hover:bg-gray-200"
                    >
                      Login
                    </Link>

                    <Link
                      href="/signup"
                      className="rounded-lg border border-gray-700 px-5 py-3 text-center font-bold text-white hover:bg-gray-900"
                    >
                      Sign Up
                    </Link>
                  </div>
                </>
              ) : userJoined ? (
                <>
                  <p className="mb-5 rounded-lg border border-green-800 bg-green-950/20 p-4 text-sm text-green-300">
                    You are registered for this tournament.
                  </p>

                  <div className="grid gap-3">
                    <Link
                      href="/my-tournaments"
                      className="rounded-lg bg-white px-5 py-3 text-center font-bold text-black hover:bg-gray-200"
                    >
                      View My Matches
                    </Link>

                    <button
                      type="button"
                      onClick={leaveTournament}
                      disabled={leaving || bracketGenerated}
                      className="rounded-lg border border-red-800 px-5 py-3 font-bold text-red-300 hover:bg-red-950/40 disabled:opacity-50"
                    >
                      {leaving
                        ? "Leaving..."
                        : bracketGenerated
                          ? "Locked"
                          : "Leave Tournament"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="mb-5 text-sm text-gray-400">
                    Join before registration closes or the bracket is generated.
                  </p>

                  <button
                    type="button"
                    onClick={joinTournament}
                    disabled={joining || !canJoin()}
                    className="w-full rounded-lg bg-white px-5 py-3 font-bold text-black hover:bg-gray-200 disabled:opacity-50"
                  >
                    {joining ? "Joining..." : "Join Tournament"}
                  </button>

                  {!canJoin() && (
                    <p className="mt-3 text-sm text-gray-500">
                      Joining is unavailable because registration is closed,
                      full, or bracket locked.
                    </p>
                  )}
                </>
              )}
            </section>

            <section className="rounded-xl border border-gray-800 bg-gray-950 p-6">
              <h2 className="mb-4 text-2xl font-bold">Bracket Status</h2>

              {bracketGenerated ? (
                <>
                  <div className="mb-4 grid gap-3">
                    <div className="rounded-lg border border-gray-800 bg-black p-4">
                      <p className="text-sm text-gray-500">Completed Matches</p>
                      <p className="mt-1 text-3xl font-black">
                        {completedMatches}/{matches.length}
                      </p>
                    </div>

                    <div className="rounded-lg border border-gray-800 bg-black p-4">
                      <p className="text-sm text-gray-500">Pending Reviews</p>
                      <p className="mt-1 text-3xl font-black">
                        {pendingReviewMatches}
                      </p>
                    </div>
                  </div>

                  <Link
                    href={`/brackets?tournament=${tournament.id}`}
                    className="block rounded-lg bg-white px-5 py-3 text-center font-bold text-black hover:bg-gray-200"
                  >
                    View Full Bracket
                  </Link>
                </>
              ) : (
                <p className="rounded-lg border border-gray-800 bg-black p-4 text-sm text-gray-400">
                  The bracket has not been generated yet. It will appear after
                  registration is ready.
                </p>
              )}
            </section>

            {isAdmin && (
              <section className="rounded-xl border border-red-900 bg-red-950/10 p-6">
                <h2 className="mb-4 text-2xl font-bold text-red-200">
                  Admin Tools
                </h2>

                <div className="grid gap-3">
                  <Link
                    href={`/admin/tournaments/${tournament.id}`}
                    className="rounded-lg bg-white px-5 py-3 text-center font-bold text-black hover:bg-gray-200"
                  >
                    Edit Tournament
                  </Link>

                  <Link
                    href="/admin/tournaments"
                    className="rounded-lg border border-red-800 px-5 py-3 text-center font-bold text-red-300 hover:bg-red-950/40"
                  >
                    Manage Bracket
                  </Link>

                  <Link
                    href="/admin/reviews"
                    className="rounded-lg border border-red-800 px-5 py-3 text-center font-bold text-red-300 hover:bg-red-950/40"
                  >
                    Score Reviews
                  </Link>
                </div>
              </section>
            )}
          </aside>
        </section>

        {matches.length > 0 && (
          <section className="rounded-xl border border-gray-800 bg-gray-950 p-6">
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-2xl font-bold">Match Preview</h2>

                <p className="mt-1 text-sm text-gray-400">
                  Quick look at current bracket matchups.
                </p>
              </div>

              <Link
                href={`/brackets?tournament=${tournament.id}`}
                className="rounded-lg border border-gray-700 px-5 py-3 text-center text-sm font-bold text-white hover:bg-gray-900"
              >
                Open Bracket
              </Link>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {matches.slice(0, 6).map((match) => (
                <article
                  key={match.id}
                  className="rounded-xl border border-gray-800 bg-black p-4"
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <h3 className="font-bold">
                      Round {match.round}, Match {match.match_number}
                    </h3>

                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-bold ${
                        match.status === "completed"
                          ? "border-green-700 bg-green-950/40 text-green-300"
                          : match.score_submitted_by
                            ? "border-yellow-700 bg-yellow-950/40 text-yellow-300"
                            : "border-gray-700 bg-gray-950 text-gray-300"
                      }`}
                    >
                      {match.status === "completed"
                        ? "Completed"
                        : match.score_submitted_by
                          ? "Pending Review"
                          : "Pending"}
                    </span>
                  </div>

                  <p className="text-sm text-gray-300">
                    {playerName(match.player1_id)} vs {playerName(match.player2_id)}
                  </p>

                  <p className="mt-2 text-sm text-gray-500">
                    Score: {scoreText(match)}
                  </p>

                  {match.winner_id && (
                    <p className="mt-2 text-sm font-bold text-green-300">
                      Winner: {playerName(match.winner_id)}
                    </p>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}