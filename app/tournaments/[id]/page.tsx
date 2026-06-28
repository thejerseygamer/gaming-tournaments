"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type Tournament = {
  id: string;
  name: string;
  game: string | null;
  platform: string | null;
  description: string | null;
  rules: string | null;
  start_time: string | null;
  registration_open: boolean;
  prize_pool: number | null;
  entry_fee: number | null;
  max_players: number | null;
  created_at: string;
};

type PlayerProfile = {
  id: string;
  gamer_tag: string | null;
  platform: string | null;
  favorite_team: string | null;
};

type TournamentPlayerRow = {
  player_id: string;
};

export default function TournamentDetailsPage() {
  const router = useRouter();
  const params = useParams();

  const tournamentId =
    typeof params.id === "string"
      ? params.id
      : Array.isArray(params.id)
      ? params.id[0]
      : "";

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [players, setPlayers] = useState<PlayerProfile[]>([]);
  const [playerCount, setPlayerCount] = useState(0);
  const [currentUserId, setCurrentUserId] = useState("");
  const [hasProfile, setHasProfile] = useState(false);
  const [alreadyJoined, setAlreadyJoined] = useState(false);
  const [bracketGenerated, setBracketGenerated] = useState(false);

  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [message, setMessage] = useState("");

  function formatDisplayDate(value: string | null) {
    if (!value) return "Not set";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "Not set";

    return date.toLocaleString();
  }

  async function loadTournamentDetails(id: string) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const userId = user?.id || "";
    setCurrentUserId(userId);

    if (userId) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", userId)
        .maybeSingle();

      setHasProfile(Boolean(profileData));
    } else {
      setHasProfile(false);
    }

    const { data: tournamentData, error: tournamentError } = await supabase
      .from("tournaments")
      .select("*")
      .eq("id", id)
      .single();

    if (tournamentError) {
      setMessage(`Error loading tournament: ${tournamentError.message}`);
      setTournament(null);
      setLoading(false);
      return;
    }

    const { data: playerRows, error: playersError } = await supabase
      .from("tournament_players")
      .select("player_id")
      .eq("tournament_id", id);

    if (playersError) {
      setMessage(`Error loading players: ${playersError.message}`);
      setPlayers([]);
      setPlayerCount(0);
      setTournament(tournamentData as Tournament);
      setLoading(false);
      return;
    }

    const { count: matchCount, error: matchCountError } = await supabase
      .from("matches")
      .select("*", { count: "exact", head: true })
      .eq("tournament_id", id);

    if (matchCountError) {
      setMessage(`Error checking bracket: ${matchCountError.message}`);
      setBracketGenerated(false);
    } else {
      setBracketGenerated(Boolean(matchCount && matchCount > 0));
    }

    const joinedRows = (playerRows || []) as TournamentPlayerRow[];
    const playerIds = joinedRows.map((row) => row.player_id);

    setPlayerCount(playerIds.length);
    setAlreadyJoined(userId ? playerIds.includes(userId) : false);

    if (playerIds.length === 0) {
      setPlayers([]);
      setTournament(tournamentData as Tournament);
      setLoading(false);
      return;
    }

    const { data: profilesData, error: profilesError } = await supabase
      .from("profiles")
      .select("id, gamer_tag, platform, favorite_team")
      .in("id", playerIds);

    if (profilesError) {
      setMessage(`Error loading player profiles: ${profilesError.message}`);
      setPlayers([]);
    } else {
      setPlayers((profilesData || []) as PlayerProfile[]);
    }

    setTournament(tournamentData as Tournament);
    setLoading(false);
  }

  useEffect(() => {
    if (!tournamentId) return;

    let isMounted = true;

    async function loadPage() {
      if (!isMounted) return;

      await loadTournamentDetails(tournamentId);
    }

    loadPage();

    return () => {
      isMounted = false;
    };
  }, [tournamentId]);

  async function joinTournament() {
    if (!tournament) return;

    setJoining(true);
    setMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setMessage("You must be logged in to join this tournament.");
      setJoining(false);
      router.push("/login");
      return;
    }

    if (bracketGenerated) {
      setMessage(
        "Registration is locked because the bracket has already been generated."
      );
      setJoining(false);
      return;
    }

    if (tournament.registration_open === false) {
      setMessage("Registration is closed for this tournament.");
      setJoining(false);
      return;
    }

    if (!hasProfile) {
      setMessage("Please create your profile before joining a tournament.");
      setJoining(false);
      router.push("/profile");
      return;
    }

    if (alreadyJoined) {
      setMessage("You already joined this tournament.");
      setJoining(false);
      return;
    }

    if (
      tournament.max_players &&
      tournament.max_players > 0 &&
      playerCount >= tournament.max_players
    ) {
      setMessage("This tournament is already full.");
      setJoining(false);
      return;
    }

    const { error: joinError } = await supabase
      .from("tournament_players")
      .insert({
        tournament_id: tournament.id,
        player_id: user.id,
      });

    if (joinError) {
      setMessage(`Error joining tournament: ${joinError.message}`);
      setJoining(false);
      return;
    }

    setMessage("You joined this tournament successfully.");
    await loadTournamentDetails(tournament.id);
    setJoining(false);
  }

  async function leaveTournament() {
    if (!tournament || !currentUserId) return;

    if (bracketGenerated) {
      setMessage(
        "You cannot leave after the bracket has been generated. Contact an admin if you need help."
      );
      return;
    }

    const confirmed = window.confirm(
      `Leave "${tournament.name}"? You can join again later if spots are still open.`
    );

    if (!confirmed) return;

    setLeaving(true);
    setMessage("");

    const { error } = await supabase
      .from("tournament_players")
      .delete()
      .eq("tournament_id", tournament.id)
      .eq("player_id", currentUserId);

    if (error) {
      setMessage(`Error leaving tournament: ${error.message}`);
      setLeaving(false);
      return;
    }

    setMessage("You left this tournament.");
    await loadTournamentDetails(tournament.id);
    setLeaving(false);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black p-6 text-white">
        <div className="mx-auto max-w-5xl">
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
        <div className="mx-auto max-w-5xl">
          <div className="rounded-xl border border-red-900 bg-red-950/40 p-6">
            <h1 className="mb-2 text-3xl font-bold">Tournament not found</h1>

            <p className="mb-4 text-red-200">
              {message || "This tournament could not be loaded."}
            </p>

            <Link
              href="/tournaments"
              className="inline-block rounded-lg bg-white px-5 py-3 font-bold text-black hover:bg-gray-200"
            >
              Back to Tournaments
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const maxPlayers = tournament.max_players || 0;
  const spotsLeft =
    maxPlayers > 0 ? Math.max(maxPlayers - playerCount, 0) : null;

  const tournamentIsFull = maxPlayers > 0 && playerCount >= maxPlayers;
  const registrationLocked = bracketGenerated;
  const registrationClosed = tournament.registration_open === false;
  const joinDisabled =
    joining || tournamentIsFull || registrationLocked || registrationClosed;

  let registrationLabel = "Registration Open";
  let registrationClass =
    "border-green-700 bg-green-950/40 text-green-300";

  if (registrationLocked) {
    registrationLabel = "Registration Locked";
    registrationClass =
      "border-yellow-700 bg-yellow-950/40 text-yellow-300";
  } else if (registrationClosed) {
    registrationLabel = "Registration Closed";
    registrationClass = "border-red-700 bg-red-950/40 text-red-300";
  }

  let joinButtonText = "Join Tournament";

  if (joining) {
    joinButtonText = "Joining...";
  } else if (registrationLocked) {
    joinButtonText = "Registration Locked";
  } else if (registrationClosed) {
    joinButtonText = "Registration Closed";
  } else if (tournamentIsFull) {
    joinButtonText = "Tournament Full";
  }

  return (
    <main className="min-h-screen bg-black p-6 text-white">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/tournaments"
          className="mb-6 inline-block text-sm text-gray-400 hover:text-white"
        >
          ← Back to Tournaments
        </Link>

        <section className="mb-6 rounded-2xl border border-gray-800 bg-gray-950 p-6">
          <div className="mb-6 flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="mb-3 text-sm font-bold uppercase tracking-[0.25em] text-red-500">
                Tournament Details
              </p>

              <h1 className="mb-2 text-4xl font-black">{tournament.name}</h1>

              <p className="text-gray-400">
                Created {new Date(tournament.created_at).toLocaleDateString()}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <span
                className={`w-fit rounded-full border px-4 py-2 text-sm font-bold ${
                  tournamentIsFull
                    ? "border-red-700 bg-red-950/40 text-red-300"
                    : "border-green-700 bg-green-950/40 text-green-300"
                }`}
              >
                {tournamentIsFull ? "Full" : "Spots Open"}
              </span>

              <span
                className={`w-fit rounded-full border px-4 py-2 text-sm font-bold ${registrationClass}`}
              >
                {registrationLabel}
              </span>
            </div>
          </div>

          <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg border border-gray-800 bg-black p-4">
              <p className="text-sm text-gray-500">Game</p>
              <p className="text-xl font-bold">
                {tournament.game || "Not set"}
              </p>
            </div>

            <div className="rounded-lg border border-gray-800 bg-black p-4">
              <p className="text-sm text-gray-500">Platform</p>
              <p className="text-xl font-bold">
                {tournament.platform || "Not set"}
              </p>
            </div>

            <div className="rounded-lg border border-gray-800 bg-black p-4">
              <p className="text-sm text-gray-500">Start Time</p>
              <p className="text-xl font-bold">
                {formatDisplayDate(tournament.start_time)}
              </p>
            </div>

            <div className="rounded-lg border border-gray-800 bg-black p-4">
              <p className="text-sm text-gray-500">Prize Pool</p>
              <p className="text-xl font-bold">
                ${tournament.prize_pool || 0}
              </p>
            </div>

            <div className="rounded-lg border border-gray-800 bg-black p-4">
              <p className="text-sm text-gray-500">Entry Fee</p>
              <p className="text-xl font-bold">
                ${tournament.entry_fee || 0}
              </p>
            </div>

            <div className="rounded-lg border border-gray-800 bg-black p-4">
              <p className="text-sm text-gray-500">Players Joined</p>
              <p className="text-xl font-bold">
                {playerCount}
                {maxPlayers > 0 ? ` / ${maxPlayers}` : ""}
              </p>
            </div>
          </div>

          <div className="mb-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-gray-800 bg-black p-5">
              <h2 className="mb-2 text-2xl font-bold">Description</h2>
              <p className="whitespace-pre-wrap text-gray-300">
                {tournament.description || "No description has been added yet."}
              </p>
            </div>

            <div className="rounded-xl border border-gray-800 bg-black p-5">
              <h2 className="mb-2 text-2xl font-bold">Rules</h2>
              <p className="whitespace-pre-wrap text-gray-300">
                {tournament.rules || "No rules have been added yet."}
              </p>
            </div>
          </div>

          <div className="mb-6 rounded-lg border border-gray-800 bg-black p-4">
            <p className="text-sm text-gray-500">Spots Left</p>
            <p className="text-xl font-bold">
              {spotsLeft === null ? "Unlimited" : spotsLeft}
            </p>
          </div>

          {alreadyJoined && (
            <p className="mb-4 rounded-lg border border-green-800 bg-green-950/30 p-3 text-sm text-green-300">
              You are joined in this tournament.
            </p>
          )}

          {registrationLocked && (
            <p className="mb-4 rounded-lg border border-yellow-800 bg-yellow-950/30 p-3 text-sm text-yellow-300">
              The bracket has been generated. Players can no longer join or
              leave this tournament.
            </p>
          )}

          {!registrationLocked && registrationClosed && (
            <p className="mb-4 rounded-lg border border-red-800 bg-red-950/30 p-3 text-sm text-red-300">
              Registration is currently closed by the admin.
            </p>
          )}

          {!currentUserId && (
            <p className="mb-4 rounded-lg border border-gray-800 bg-black p-3 text-sm text-gray-300">
              Log in or create an account to join this tournament.
            </p>
          )}

          {currentUserId && !hasProfile && (
            <p className="mb-4 rounded-lg border border-yellow-800 bg-yellow-950/30 p-3 text-sm text-yellow-300">
              Create your profile before joining tournaments.
            </p>
          )}

          <div className="grid gap-3 md:grid-cols-3">
            {!alreadyJoined ? (
              <button
                type="button"
                onClick={joinTournament}
                disabled={joinDisabled}
                className="rounded-lg bg-white px-5 py-3 font-bold text-black hover:bg-gray-200 disabled:opacity-50"
              >
                {joinButtonText}
              </button>
            ) : (
              <button
                type="button"
                onClick={leaveTournament}
                disabled={leaving || registrationLocked}
                className="rounded-lg border border-red-800 px-5 py-3 font-bold text-red-300 hover:bg-red-950/40 disabled:opacity-50"
              >
                {leaving
                  ? "Leaving..."
                  : registrationLocked
                  ? "Locked"
                  : "Leave Tournament"}
              </button>
            )}

            <Link
              href={`/brackets?tournament=${tournament.id}`}
              className="rounded-lg border border-gray-700 px-5 py-3 text-center font-bold text-white hover:bg-gray-900"
            >
              View Bracket
            </Link>

            <Link
              href="/my-tournaments"
              className="rounded-lg border border-gray-700 px-5 py-3 text-center font-bold text-white hover:bg-gray-900"
            >
              My Tournaments
            </Link>
          </div>

          {message && (
            <p className="mt-4 rounded-lg border border-gray-800 bg-black p-3 text-sm text-gray-300">
              {message}
            </p>
          )}
        </section>

        <section className="rounded-xl border border-gray-800 bg-gray-950 p-6">
          <h2 className="mb-4 text-2xl font-bold">Joined Players</h2>

          {players.length === 0 ? (
            <p className="text-gray-400">No players have joined yet.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {players.map((player, index) => (
                <div
                  key={player.id}
                  className={`rounded-lg border p-4 ${
                    player.id === currentUserId
                      ? "border-green-700 bg-green-950/20"
                      : "border-gray-800 bg-black"
                  }`}
                >
                  <p className="text-lg font-bold">
                    #{index + 1} {player.gamer_tag || "Unnamed Player"}
                    {player.id === currentUserId ? " — You" : ""}
                  </p>

                  <div className="mt-1 grid gap-1 text-sm text-gray-400">
                    <p>Platform: {player.platform || "Not set"}</p>
                    <p>Favorite Team: {player.favorite_team || "Not set"}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}