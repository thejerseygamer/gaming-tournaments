"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { checkIsAdmin } from "../../../lib/admin";

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

function toDateTimeLocalValue(value: string | null) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  const timezoneOffset = date.getTimezoneOffset() * 60000;
  const localDate = new Date(date.getTime() - timezoneOffset);

  return localDate.toISOString().slice(0, 16);
}

function numberOrNull(value: string) {
  if (!value.trim()) return null;

  const parsedValue = Number(value);

  if (Number.isNaN(parsedValue)) return null;

  return parsedValue;
}

function integerOrNull(value: string) {
  if (!value.trim()) return null;

  const parsedValue = Number.parseInt(value, 10);

  if (Number.isNaN(parsedValue)) return null;

  return parsedValue;
}

function dateOrNull(value: string) {
  if (!value.trim()) return null;

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) return null;

  return parsedDate.toISOString();
}

function formatDateTime(value: string | null) {
  if (!value) return "Not set";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not set";

  return date.toLocaleString();
}

export default function AdminEditTournamentPage() {
  const params = useParams();
  const router = useRouter();

  const tournamentId = typeof params.id === "string" ? params.id : "";

  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [matchCount, setMatchCount] = useState(0);
  const [playerRows, setPlayerRows] = useState<TournamentPlayer[]>([]);
  const [profilesById, setProfilesById] = useState<
    Record<string, PlayerProfile>
  >({});

  const [name, setName] = useState("");
  const [game, setGame] = useState("");
  const [platform, setPlatform] = useState("");
  const [description, setDescription] = useState("");
  const [rules, setRules] = useState("");
  const [startTime, setStartTime] = useState("");
  const [prizePool, setPrizePool] = useState("");
  const [entryFee, setEntryFee] = useState("");
  const [maxPlayers, setMaxPlayers] = useState("");
  const [registrationOpen, setRegistrationOpen] = useState(true);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removingPlayerId, setRemovingPlayerId] = useState("");
  const [message, setMessage] = useState("");

  const loadTournamentDetails = useCallback(async () => {
    setCheckingAdmin(true);
    setLoading(true);
    setMessage("");

    const adminCheck = await checkIsAdmin();

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

    if (!tournamentId) {
      setMessage("Tournament not found.");
      setTournament(null);
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
      setLoading(false);
      return;
    }

    if (!tournamentData) {
      setMessage("Tournament not found.");
      setTournament(null);
      setLoading(false);
      return;
    }

    const loadedTournament = tournamentData as Tournament;

    setTournament(loadedTournament);
    setName(loadedTournament.name || "");
    setGame(loadedTournament.game || "");
    setPlatform(loadedTournament.platform || "");
    setDescription(loadedTournament.description || "");
    setRules(loadedTournament.rules || "");
    setStartTime(toDateTimeLocalValue(loadedTournament.start_time));
    setPrizePool(
      loadedTournament.prize_pool === null ||
        loadedTournament.prize_pool === undefined
        ? ""
        : String(loadedTournament.prize_pool)
    );
    setEntryFee(
      loadedTournament.entry_fee === null ||
        loadedTournament.entry_fee === undefined
        ? ""
        : String(loadedTournament.entry_fee)
    );
    setMaxPlayers(
      loadedTournament.max_players === null ||
        loadedTournament.max_players === undefined
        ? ""
        : String(loadedTournament.max_players)
    );
    setRegistrationOpen(loadedTournament.registration_open);

    const { count: matchesTotal, error: matchError } = await supabase
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("tournament_id", tournamentId);

    if (matchError) {
      setMessage(`Error checking bracket status: ${matchError.message}`);
      setMatchCount(0);
    } else {
      setMatchCount(matchesTotal || 0);
    }

    const { data: joinedRows, error: joinedError } = await supabase
      .from("tournament_players")
      .select("tournament_id, player_id")
      .eq("tournament_id", tournamentId);

    if (joinedError) {
      setMessage(`Error loading registered players: ${joinedError.message}`);
      setPlayerRows([]);
      setProfilesById({});
      setLoading(false);
      return;
    }

    const loadedPlayerRows = (joinedRows || []) as TournamentPlayer[];

    setPlayerRows(loadedPlayerRows);

    const playerIds = loadedPlayerRows.map((row) => row.player_id);

    if (playerIds.length > 0) {
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, gamer_tag, platform, favorite_team")
        .in("id", playerIds);

      if (profileError) {
        setMessage(`Error loading player profiles: ${profileError.message}`);
        setProfilesById({});
      } else {
        const profileMap = ((profileData || []) as PlayerProfile[]).reduce(
          (acc, profile) => {
            acc[profile.id] = profile;
            return acc;
          },
          {} as Record<string, PlayerProfile>
        );

        setProfilesById(profileMap);
      }
    } else {
      setProfilesById({});
    }

    setLoading(false);
  }, [router, tournamentId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadTournamentDetails();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadTournamentDetails]);

  const bracketGenerated = useMemo(() => {
    return matchCount > 0;
  }, [matchCount]);

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

  function playerName(profile: PlayerProfile | null) {
    return profile?.gamer_tag || "Unnamed Player";
  }

  async function saveTournament(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!tournament) return;

    if (!name.trim()) {
      setMessage("Tournament name is required.");
      return;
    }

    const parsedMaxPlayers = integerOrNull(maxPlayers);

    if (parsedMaxPlayers !== null && parsedMaxPlayers < 2) {
      setMessage("Max players must be at least 2.");
      return;
    }

    if (parsedMaxPlayers !== null && parsedMaxPlayers < playerCount) {
      setMessage(
        `Max players cannot be lower than the current registered player count (${playerCount}).`
      );
      return;
    }

    setSaving(true);
    setMessage("");

    const { error } = await supabase
      .from("tournaments")
      .update({
        name: name.trim(),
        game: game.trim() || null,
        platform: platform.trim() || null,
        description: description.trim() || null,
        rules: rules.trim() || null,
        start_time: dateOrNull(startTime),
        prize_pool: numberOrNull(prizePool),
        entry_fee: numberOrNull(entryFee),
        max_players: parsedMaxPlayers,
        registration_open: bracketGenerated
          ? tournament.registration_open
          : registrationOpen,
      })
      .eq("id", tournament.id);

    if (error) {
      setMessage(`Error saving tournament: ${error.message}`);
      setSaving(false);
      return;
    }

    setMessage("Tournament updated successfully.");
    await loadTournamentDetails();
    setSaving(false);
  }

  async function removePlayerFromTournament(playerId: string) {
    if (!tournament) return;

    if (bracketGenerated) {
      setMessage(
        "Players cannot be removed after the bracket has been generated."
      );
      return;
    }

    const profile = profilesById[playerId];
    const confirmed = window.confirm(
      `Remove ${playerName(profile)} from "${tournament.name}"?`
    );

    if (!confirmed) return;

    setRemovingPlayerId(playerId);
    setMessage("");

    const { error } = await supabase
      .from("tournament_players")
      .delete()
      .eq("tournament_id", tournament.id)
      .eq("player_id", playerId);

    if (error) {
      setMessage(`Error removing player: ${error.message}`);
      setRemovingPlayerId("");
      return;
    }

    setMessage(`${playerName(profile)} was removed from the tournament.`);
    await loadTournamentDetails();
    setRemovingPlayerId("");
  }

  if (checkingAdmin || loading) {
    return (
      <main className="min-h-screen bg-black p-6 text-white">
        <div className="mx-auto max-w-6xl">
          <p className="rounded-xl border border-gray-800 bg-gray-950 p-6 text-gray-400">
            {checkingAdmin ? "Checking admin access..." : "Loading tournament..."}
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
              href="/admin"
              className="inline-block rounded-lg bg-white px-5 py-3 font-bold text-black hover:bg-gray-200"
            >
              Back to Admin
            </Link>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black p-6 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Link href="/admin" className="text-sm text-gray-400 hover:text-white">
            ← Back to Admin
          </Link>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href={`/tournaments/${tournament.id}`}
              className="text-sm text-gray-400 hover:text-white"
            >
              Public Page →
            </Link>

            <Link
              href={`/brackets?tournament=${tournament.id}`}
              className="text-sm text-gray-400 hover:text-white"
            >
              Bracket →
            </Link>

            <Link
              href="/admin/tournaments"
              className="text-sm text-gray-400 hover:text-white"
            >
              Bracket Manager →
            </Link>
          </div>
        </div>

        <section className="mb-8 rounded-2xl border border-gray-800 bg-gray-950 p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="mb-3 text-sm font-bold uppercase tracking-[0.25em] text-red-500">
                Admin Tools
              </p>

              <h1 className="mb-3 text-4xl font-black">Edit Tournament</h1>

              <p className="max-w-2xl text-gray-400">
                Update tournament details, manage registration, and remove
                players before brackets are generated.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-gray-800 bg-black p-4">
                <p className="text-sm text-gray-500">Players</p>
                <p className="mt-2 text-3xl font-black">
                  {playerCount}/{tournament.max_players || "∞"}
                </p>
              </div>

              <div className="rounded-xl border border-gray-800 bg-black p-4">
                <p className="text-sm text-gray-500">Bracket Status</p>
                <p className="mt-2 text-xl font-black">
                  {bracketGenerated ? "Locked" : "Not Generated"}
                </p>
              </div>
            </div>
          </div>
        </section>

        {message && (
          <p className="mb-6 rounded-lg border border-yellow-800 bg-yellow-950/30 p-4 text-sm text-yellow-200">
            {message}
          </p>
        )}

        {bracketGenerated && (
          <p className="mb-6 rounded-lg border border-yellow-800 bg-yellow-950/30 p-4 text-sm text-yellow-200">
            This tournament already has a bracket. You can still edit details,
            but registration and player removal are locked to protect the
            bracket.
          </p>
        )}

        <section className="mb-8 rounded-xl border border-gray-800 bg-gray-950 p-6">
          <form onSubmit={saveTournament} className="grid gap-4">
            <div>
              <label className="mb-2 block text-sm text-gray-400">
                Tournament Name
              </label>

              <input
                className="w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                placeholder="Friday Night Madden"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm text-gray-400">Game</label>

                <input
                  className="w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                  placeholder="Madden"
                  value={game}
                  onChange={(event) => setGame(event.target.value)}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-gray-400">
                  Platform
                </label>

                <input
                  className="w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                  placeholder="PS5 / Xbox / Both"
                  value={platform}
                  onChange={(event) => setPlatform(event.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm text-gray-400">
                Description
              </label>

              <textarea
                className="min-h-28 w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                placeholder="Tournament details..."
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-gray-400">Rules</label>

              <textarea
                className="min-h-28 w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                placeholder="Rules, settings, and match requirements..."
                value={rules}
                onChange={(event) => setRules(event.target.value)}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-gray-400">
                Start Time
              </label>

              <input
                type="datetime-local"
                className="w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
              />

              <p className="mt-2 text-xs text-gray-500">
                Current saved start: {formatDateTime(tournament.start_time)}
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm text-gray-400">
                  Prize Pool
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                  placeholder="0"
                  value={prizePool}
                  onChange={(event) => setPrizePool(event.target.value)}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-gray-400">
                  Entry Fee
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                  placeholder="0"
                  value={entryFee}
                  onChange={(event) => setEntryFee(event.target.value)}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-gray-400">
                  Max Players
                </label>

                <input
                  type="number"
                  min="2"
                  step="1"
                  className="w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                  placeholder="8"
                  value={maxPlayers}
                  onChange={(event) => setMaxPlayers(event.target.value)}
                />
              </div>
            </div>

            <label
              className={`flex items-center gap-3 rounded-lg border border-gray-800 bg-black p-4 text-sm ${
                bracketGenerated ? "text-gray-500" : "text-gray-300"
              }`}
            >
              <input
                type="checkbox"
                checked={registrationOpen}
                disabled={bracketGenerated}
                onChange={(event) => setRegistrationOpen(event.target.checked)}
              />

              Registration open
            </label>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-white px-5 py-3 font-bold text-black hover:bg-gray-200 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Tournament"}
              </button>

              <Link
                href="/admin"
                className="rounded-lg border border-gray-700 px-5 py-3 text-center font-bold text-white hover:bg-gray-900"
              >
                Cancel
              </Link>
            </div>
          </form>
        </section>

        <section className="rounded-xl border border-gray-800 bg-gray-950 p-6">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-2xl font-bold">Registered Players</h2>

              <p className="mt-1 text-sm text-gray-400">
                Remove players here before the bracket is generated.
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
            <div className="grid gap-4 md:grid-cols-2">
              {registeredPlayers.map(({ row, profile }, index) => (
                <div
                  key={row.player_id}
                  className="rounded-xl border border-gray-800 bg-black p-4"
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <Link
                        href={`/players/${row.player_id}`}
                        className="text-lg font-bold hover:text-red-400"
                      >
                        {index + 1}. {playerName(profile)}
                      </Link>

                      <p className="mt-1 text-sm text-gray-400">
                        {profile?.platform || "Platform not set"} •{" "}
                        {profile?.favorite_team || "Favorite team not set"}
                      </p>
                    </div>

                    <span className="rounded-full border border-gray-700 px-3 py-1 text-xs font-bold text-gray-300">
                      Player
                    </span>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Link
                      href={`/players/${row.player_id}`}
                      className="rounded-lg border border-gray-700 px-4 py-3 text-center text-sm font-bold text-white hover:bg-gray-900"
                    >
                      View Profile
                    </Link>

                    <button
                      type="button"
                      onClick={() => removePlayerFromTournament(row.player_id)}
                      disabled={
                        bracketGenerated || removingPlayerId === row.player_id
                      }
                      className="rounded-lg border border-red-800 px-4 py-3 text-sm font-bold text-red-300 hover:bg-red-950/40 disabled:opacity-50"
                    >
                      {removingPlayerId === row.player_id
                        ? "Removing..."
                        : bracketGenerated
                          ? "Locked"
                          : "Remove Player"}
                    </button>
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