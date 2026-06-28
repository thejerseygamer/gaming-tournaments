"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { checkIsAdmin } from "../../lib/admin";

type Tournament = {
  id: string;
  name: string;
  game: string | null;
  platform: string | null;
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
};

export default function AdminPlayersPage() {
  const router = useRouter();

  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState("");
  const [tournamentPlayers, setTournamentPlayers] = useState<
    TournamentPlayer[]
  >([]);
  const [profiles, setProfiles] = useState<Record<string, PlayerProfile>>({});
  const [matches, setMatches] = useState<Match[]>([]);

  const [loading, setLoading] = useState(true);
  const [removingPlayerId, setRemovingPlayerId] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function verifyAdminAndLoad() {
      const adminCheck = await checkIsAdmin();

      if (!isMounted) return;

      if (!adminCheck.user) {
        router.push("/login");
        return;
      }

      if (!adminCheck.isAdmin) {
        router.push("/tournaments");
        return;
      }

      setIsAdmin(true);
      setCheckingAdmin(false);

      const { data, error } = await supabase
        .from("tournaments")
        .select("id, name, game, platform, created_at")
        .order("created_at", { ascending: false });

      if (!isMounted) return;

      if (error) {
        setMessage(`Error loading tournaments: ${error.message}`);
        setTournaments([]);
        setLoading(false);
        return;
      }

      const loadedTournaments = (data || []) as Tournament[];

      setTournaments(loadedTournaments);

      if (loadedTournaments.length > 0) {
        setSelectedTournamentId(loadedTournaments[0].id);
      }

      setLoading(false);
    }

    verifyAdminAndLoad();

    return () => {
      isMounted = false;
    };
  }, [router]);

  useEffect(() => {
    if (!selectedTournamentId) return;

    let isMounted = true;

    async function loadPlayers() {
      setMessage("");

      const { data: playerRows, error: playersError } = await supabase
        .from("tournament_players")
        .select("tournament_id, player_id")
        .eq("tournament_id", selectedTournamentId);

      if (!isMounted) return;

      if (playersError) {
        setMessage(`Error loading players: ${playersError.message}`);
        setTournamentPlayers([]);
        setProfiles({});
        return;
      }

      const joinedPlayers = (playerRows || []) as TournamentPlayer[];
      setTournamentPlayers(joinedPlayers);

      const playerIds = joinedPlayers.map((row) => row.player_id);

      if (playerIds.length === 0) {
        setProfiles({});
      } else {
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("id, gamer_tag, platform, favorite_team")
          .in("id", playerIds);

        if (!isMounted) return;

        if (profileError) {
          setMessage(`Error loading profiles: ${profileError.message}`);
          setProfiles({});
        } else {
          const profileMap = ((profileData || []) as PlayerProfile[]).reduce(
            (acc, profile) => {
              acc[profile.id] = profile;
              return acc;
            },
            {} as Record<string, PlayerProfile>
          );

          setProfiles(profileMap);
        }
      }

      const { data: matchData, error: matchError } = await supabase
        .from("matches")
        .select("id, tournament_id")
        .eq("tournament_id", selectedTournamentId);

      if (!isMounted) return;

      if (matchError) {
        setMessage(`Error checking bracket: ${matchError.message}`);
        setMatches([]);
      } else {
        setMatches((matchData || []) as Match[]);
      }
    }

    loadPlayers();

    return () => {
      isMounted = false;
    };
  }, [selectedTournamentId]);

  const selectedTournament = useMemo(() => {
    return (
      tournaments.find((tournament) => tournament.id === selectedTournamentId) ||
      null
    );
  }, [tournaments, selectedTournamentId]);

  const bracketAlreadyGenerated = matches.length > 0;

  async function verifyAdminAction() {
    const adminCheck = await checkIsAdmin();

    if (!adminCheck.user) {
      setMessage("You must be logged in as an admin.");
      router.push("/login");
      return false;
    }

    if (!adminCheck.isAdmin) {
      setMessage("You are not allowed to manage players.");
      router.push("/tournaments");
      return false;
    }

    return true;
  }

  async function reloadPlayers() {
    if (!selectedTournamentId) return;

    const { data: playerRows, error: playersError } = await supabase
      .from("tournament_players")
      .select("tournament_id, player_id")
      .eq("tournament_id", selectedTournamentId);

    if (playersError) {
      setMessage(`Error refreshing players: ${playersError.message}`);
      return;
    }

    const joinedPlayers = (playerRows || []) as TournamentPlayer[];
    setTournamentPlayers(joinedPlayers);

    const playerIds = joinedPlayers.map((row) => row.player_id);

    if (playerIds.length === 0) {
      setProfiles({});
      return;
    }

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id, gamer_tag, platform, favorite_team")
      .in("id", playerIds);

    if (profileError) {
      setMessage(`Error refreshing profiles: ${profileError.message}`);
      return;
    }

    const profileMap = ((profileData || []) as PlayerProfile[]).reduce(
      (acc, profile) => {
        acc[profile.id] = profile;
        return acc;
      },
      {} as Record<string, PlayerProfile>
    );

    setProfiles(profileMap);
  }

  async function removePlayer(playerId: string) {
    if (!selectedTournament) return;

    if (bracketAlreadyGenerated) {
      setMessage(
        "You cannot remove players after a bracket has been generated. Delete/regenerate the bracket first."
      );
      return;
    }

    const profile = profiles[playerId];

    const confirmed = window.confirm(
      `Remove ${
        profile?.gamer_tag || "this player"
      } from "${selectedTournament.name}"?`
    );

    if (!confirmed) return;

    setRemovingPlayerId(playerId);
    setMessage("");

    const allowed = await verifyAdminAction();

    if (!allowed) {
      setRemovingPlayerId("");
      return;
    }

    const { error } = await supabase
      .from("tournament_players")
      .delete()
      .eq("tournament_id", selectedTournament.id)
      .eq("player_id", playerId);

    if (error) {
      setMessage(`Error removing player: ${error.message}`);
      setRemovingPlayerId("");
      return;
    }

    setMessage("Player removed successfully.");
    await reloadPlayers();
    setRemovingPlayerId("");
  }

  if (checkingAdmin) {
    return (
      <main className="min-h-screen bg-black p-6 text-white">
        <div className="mx-auto max-w-5xl">
          <p className="rounded-xl border border-gray-800 bg-gray-950 p-6 text-gray-400">
            Checking admin access...
          </p>
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-black p-6 text-white">
        <div className="mx-auto max-w-5xl">
          <p className="rounded-xl border border-red-900 bg-red-950/40 p-6 text-red-200">
            You do not have admin access.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black p-6 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Link
            href="/admin"
            className="text-sm text-gray-400 hover:text-white"
          >
            ← Back to Admin
          </Link>

          <Link
            href="/admin/tournaments"
            className="text-sm text-gray-400 hover:text-white"
          >
            Manage Brackets →
          </Link>
        </div>

        <section className="mb-8 rounded-2xl border border-gray-800 bg-gray-950 p-6">
          <p className="mb-3 text-sm font-bold uppercase tracking-[0.25em] text-red-500">
            Admin Tools
          </p>

          <h1 className="mb-3 text-4xl font-black">Player Manager</h1>

          <p className="max-w-2xl text-gray-400">
            View and manage players who joined each tournament.
          </p>
        </section>

        {message && (
          <p className="mb-6 rounded-lg border border-gray-800 bg-gray-950 p-4 text-sm text-gray-300">
            {message}
          </p>
        )}

        {loading ? (
          <p className="rounded-xl border border-gray-800 bg-gray-950 p-6 text-gray-400">
            Loading tournaments...
          </p>
        ) : tournaments.length === 0 ? (
          <section className="rounded-xl border border-gray-800 bg-gray-950 p-6">
            <h2 className="mb-2 text-2xl font-bold">No tournaments found</h2>
            <p className="mb-4 text-gray-400">
              Create a tournament first before managing players.
            </p>

            <Link
              href="/admin"
              className="inline-block rounded-lg bg-white px-5 py-3 font-bold text-black hover:bg-gray-200"
            >
              Create Tournament
            </Link>
          </section>
        ) : (
          <>
            <section className="mb-6 rounded-xl border border-gray-800 bg-gray-950 p-5">
              <label className="mb-2 block text-sm text-gray-400">
                Select Tournament
              </label>

              <select
                className="w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                value={selectedTournamentId}
                onChange={(e) => setSelectedTournamentId(e.target.value)}
              >
                {tournaments.map((tournament) => (
                  <option key={tournament.id} value={tournament.id}>
                    {tournament.name}
                  </option>
                ))}
              </select>
            </section>

            <section className="rounded-xl border border-gray-800 bg-gray-950 p-6">
              <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-2xl font-bold">
                    {selectedTournament?.name || "Tournament"}
                  </h2>

                  <p className="mt-1 text-sm text-gray-400">
                    {selectedTournament?.game || "Game not set"} •{" "}
                    {selectedTournament?.platform || "Platform not set"}
                  </p>
                </div>

                <span className="w-fit rounded-full border border-gray-700 px-3 py-1 text-xs font-bold text-gray-300">
                  {tournamentPlayers.length} players
                </span>
              </div>

              {bracketAlreadyGenerated && (
                <p className="mb-5 rounded-lg border border-yellow-800 bg-yellow-950/30 p-3 text-sm text-yellow-300">
                  A bracket already exists for this tournament. Remove players
                  only before bracket generation, or delete/regenerate the
                  bracket from Manage Brackets.
                </p>
              )}

              {tournamentPlayers.length === 0 ? (
                <p className="text-gray-400">
                  No players have joined this tournament yet.
                </p>
              ) : (
                <div className="grid gap-4">
                  {tournamentPlayers.map((row, index) => {
                    const profile = profiles[row.player_id];

                    return (
                      <div
                        key={row.player_id}
                        className="rounded-lg border border-gray-800 bg-black p-4"
                      >
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                          <div>
                            <h3 className="text-xl font-bold">
                              #{index + 1}{" "}
                              {profile?.gamer_tag || "Unnamed Player"}
                            </h3>

                            <div className="mt-2 grid gap-1 text-sm text-gray-400">
                              <p>
                                Platform: {profile?.platform || "Not set"}
                              </p>
                              <p>
                                Favorite Team:{" "}
                                {profile?.favorite_team || "Not set"}
                              </p>
                              <p>User ID: {row.player_id}</p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => removePlayer(row.player_id)}
                            disabled={
                              removingPlayerId === row.player_id ||
                              bracketAlreadyGenerated
                            }
                            className="rounded-lg border border-red-800 px-5 py-3 font-bold text-red-300 hover:bg-red-950/40 disabled:opacity-50"
                          >
                            {removingPlayerId === row.player_id
                              ? "Removing..."
                              : "Remove Player"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}