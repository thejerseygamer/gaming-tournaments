"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type Match = {
  id: string;
  tournament_id: string;
  round: number | null;
  match_number: number | null;
  player1_id: string | null;
  player2_id: string | null;
  winner_id: string | null;
};

type Tournament = {
  id: string;
  name: string;
  game: string | null;
  platform: string | null;
};

type Profile = {
  id: string;
  gamer_tag: string | null;
  platform: string | null;
  favorite_team: string | null;
};

type ReviewFilter = "all" | "needs-winner" | "completed";

export default function AdminReviewsPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [tournaments, setTournaments] = useState<Record<string, Tournament>>({});
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [searchText, setSearchText] = useState("");
  const [filter, setFilter] = useState<ReviewFilter>("needs-winner");

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const getPlayerName = useCallback(
    (playerId: string | null) => {
      if (!playerId) {
        return "Waiting for player";
      }

      const profile = profiles[playerId];

      if (profile?.gamer_tag) {
        return profile.gamer_tag;
      }

      return "Unknown Player";
    },
    [profiles]
  );

  const getPlayerPlatform = useCallback(
    (playerId: string | null) => {
      if (!playerId) {
        return "";
      }

      return profiles[playerId]?.platform || "";
    },
    [profiles]
  );

  useEffect(() => {
    let active = true;

    async function loadReviews() {
      await Promise.resolve();

      const { data: matchData, error: matchError } = await supabase
        .from("matches")
        .select(
          "id, tournament_id, round, match_number, player1_id, player2_id, winner_id"
        )
        .order("round", { ascending: true })
        .order("match_number", { ascending: true });

      if (!active) {
        return;
      }

      if (matchError) {
        setMessage(matchError.message);
        setLoading(false);
        return;
      }

      const loadedMatches = (matchData || []) as Match[];

      if (loadedMatches.length === 0) {
        setMatches([]);
        setTournaments({});
        setProfiles({});
        setLoading(false);
        return;
      }

      const tournamentIds = Array.from(
        new Set(
          loadedMatches
            .map((match) => match.tournament_id)
            .filter((id): id is string => Boolean(id))
        )
      );

      const playerIds = Array.from(
        new Set(
          loadedMatches
            .flatMap((match) => [
              match.player1_id,
              match.player2_id,
              match.winner_id,
            ])
            .filter((id): id is string => Boolean(id))
        )
      );

      const tournamentMap: Record<string, Tournament> = {};
      const profileMap: Record<string, Profile> = {};

      if (tournamentIds.length > 0) {
        const { data: tournamentData, error: tournamentError } = await supabase
          .from("tournaments")
          .select("id, name, game, platform")
          .in("id", tournamentIds);

        if (!active) {
          return;
        }

        if (tournamentError) {
          setMessage(tournamentError.message);
          setLoading(false);
          return;
        }

        ((tournamentData || []) as Tournament[]).forEach((tournament) => {
          tournamentMap[tournament.id] = tournament;
        });
      }

      if (playerIds.length > 0) {
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("id, gamer_tag, platform, favorite_team")
          .in("id", playerIds);

        if (!active) {
          return;
        }

        if (profileError) {
          setMessage(profileError.message);
          setLoading(false);
          return;
        }

        ((profileData || []) as Profile[]).forEach((profile) => {
          profileMap[profile.id] = profile;
        });
      }

      setMatches(loadedMatches);
      setTournaments(tournamentMap);
      setProfiles(profileMap);
      setLoading(false);
    }

    loadReviews();

    return () => {
      active = false;
    };
  }, []);

  const totalNeedsWinner = useMemo(() => {
    return matches.filter((match) => !match.winner_id).length;
  }, [matches]);

  const totalCompleted = useMemo(() => {
    return matches.filter((match) => Boolean(match.winner_id)).length;
  }, [matches]);

  const totalTournamentsWithMatches = useMemo(() => {
    return new Set(matches.map((match) => match.tournament_id)).size;
  }, [matches]);

  const filteredMatches = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase();

    return matches.filter((match) => {
      if (filter === "needs-winner" && match.winner_id) {
        return false;
      }

      if (filter === "completed" && !match.winner_id) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const tournament = tournaments[match.tournament_id];
      const player1Name = getPlayerName(match.player1_id).toLowerCase();
      const player2Name = getPlayerName(match.player2_id).toLowerCase();
      const winnerName = getPlayerName(match.winner_id).toLowerCase();
      const tournamentName = tournament?.name?.toLowerCase() || "";
      const game = tournament?.game?.toLowerCase() || "";
      const platform = tournament?.platform?.toLowerCase() || "";

      return (
        tournamentName.includes(normalizedSearch) ||
        game.includes(normalizedSearch) ||
        platform.includes(normalizedSearch) ||
        player1Name.includes(normalizedSearch) ||
        player2Name.includes(normalizedSearch) ||
        winnerName.includes(normalizedSearch)
      );
    });
  }, [matches, filter, searchText, tournaments, getPlayerName]);

  function getTournamentName(tournamentId: string) {
    return tournaments[tournamentId]?.name || "Unknown Tournament";
  }

  function getTournamentGame(tournamentId: string) {
    return tournaments[tournamentId]?.game || "Game not set";
  }

  function getTournamentPlatform(tournamentId: string) {
    return tournaments[tournamentId]?.platform || "Platform not set";
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-950 px-6 py-10 text-white">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-3xl font-bold">Admin Reviews</h1>
          <p className="mt-4 text-zinc-400">Loading match reviews...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="mb-2 text-sm font-black uppercase tracking-widest text-red-400">
              BattleGrid Admin
            </p>

            <h1 className="text-4xl font-black">Match Reviews</h1>

            <p className="mt-3 text-zinc-400">
              Review matches that still need winners and quickly jump to bracket
              management.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/admin"
              className="rounded-lg border border-zinc-700 px-4 py-2 text-center font-semibold text-white hover:bg-zinc-800"
            >
              Admin Dashboard
            </Link>

            <Link
              href="/admin/tournaments"
              className="rounded-lg bg-red-600 px-4 py-2 text-center font-semibold text-white hover:bg-red-700"
            >
              Manage Winners
            </Link>
          </div>
        </div>

        {message && (
          <div className="mb-6 rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-red-300">
            {message}
          </div>
        )}

        <section className="mb-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <p className="text-sm text-zinc-500">Total Matches</p>
            <p className="mt-2 text-4xl font-black">{matches.length}</p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <p className="text-sm text-zinc-500">Needs Winner</p>
            <p className="mt-2 text-4xl font-black text-yellow-300">
              {totalNeedsWinner}
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <p className="text-sm text-zinc-500">Completed</p>
            <p className="mt-2 text-4xl font-black text-green-300">
              {totalCompleted}
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <p className="text-sm text-zinc-500">Tournaments</p>
            <p className="mt-2 text-4xl font-black">
              {totalTournamentsWithMatches}
            </p>
          </div>
        </section>

        <section className="mb-8 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="grid gap-4 lg:grid-cols-[1fr_240px]">
            <div>
              <label className="mb-2 block text-sm font-semibold text-zinc-300">
                Search Reviews
              </label>

              <input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Search tournament, game, platform, or player..."
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-red-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-zinc-300">
                Review Status
              </label>

              <select
                value={filter}
                onChange={(event) =>
                  setFilter(event.target.value as ReviewFilter)
                }
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-red-500"
              >
                <option value="all">All Matches</option>
                <option value="needs-winner">Needs Winner</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold">Review Queue</h2>

              <p className="mt-2 text-sm text-zinc-400">
                Showing {filteredMatches.length} of {matches.length} matches.
              </p>
            </div>

            <Link
              href="/admin/tournaments"
              className="rounded-lg bg-red-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-red-700"
            >
              Save Winners
            </Link>
          </div>

          {matches.length === 0 && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-8 text-center">
              <h3 className="text-xl font-bold">No matches generated yet</h3>

              <p className="mt-2 text-zinc-400">
                Generate a bracket from Admin Tournaments first. Matches will
                appear here after brackets are created.
              </p>

              <Link
                href="/admin/tournaments"
                className="mt-6 inline-block rounded-lg bg-red-600 px-5 py-3 font-semibold text-white hover:bg-red-700"
              >
                Go to Admin Tournaments
              </Link>
            </div>
          )}

          {matches.length > 0 && filteredMatches.length === 0 && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-8 text-center">
              <h3 className="text-xl font-bold">No matches found</h3>

              <p className="mt-2 text-zinc-400">
                Try changing the search text or review status filter.
              </p>
            </div>
          )}

          {filteredMatches.length > 0 && (
            <div className="grid gap-5 lg:grid-cols-2">
              {filteredMatches.map((match) => {
                const player1Name = getPlayerName(match.player1_id);
                const player2Name = getPlayerName(match.player2_id);
                const winnerName = getPlayerName(match.winner_id);

                return (
                  <article
                    key={match.id}
                    className="rounded-xl border border-zinc-800 bg-zinc-950 p-5"
                  >
                    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-bold uppercase tracking-widest text-red-400">
                          {getTournamentName(match.tournament_id)}
                        </p>

                        <h3 className="mt-2 text-xl font-black">
                          Round {match.round || 1} • Match{" "}
                          {match.match_number || "?"}
                        </h3>

                        <p className="mt-2 text-sm text-zinc-400">
                          {getTournamentGame(match.tournament_id)} •{" "}
                          {getTournamentPlatform(match.tournament_id)}
                        </p>
                      </div>

                      <span
                        className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${
                          match.winner_id
                            ? "bg-green-500/10 text-green-300"
                            : "bg-yellow-500/10 text-yellow-300"
                        }`}
                      >
                        {match.winner_id ? "Completed" : "Needs Winner"}
                      </span>
                    </div>

                    <div className="space-y-3">
                      <div
                        className={`rounded-lg border p-4 ${
                          match.winner_id === match.player1_id
                            ? "border-green-500/40 bg-green-500/10"
                            : "border-zinc-800 bg-zinc-900"
                        }`}
                      >
                        <p className="font-bold">{player1Name}</p>
                        <p className="mt-1 text-sm text-zinc-500">
                          {getPlayerPlatform(match.player1_id) ||
                            "Platform not set"}
                        </p>
                      </div>

                      <div className="text-center text-xs font-black uppercase text-zinc-500">
                        vs
                      </div>

                      <div
                        className={`rounded-lg border p-4 ${
                          match.winner_id === match.player2_id
                            ? "border-green-500/40 bg-green-500/10"
                            : "border-zinc-800 bg-zinc-900"
                        }`}
                      >
                        <p className="font-bold">{player2Name}</p>
                        <p className="mt-1 text-sm text-zinc-500">
                          {getPlayerPlatform(match.player2_id) ||
                            "Platform not set"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 rounded-lg border border-zinc-800 bg-zinc-900 p-4">
                      <p className="text-sm text-zinc-500">Winner</p>

                      <p
                        className={`mt-1 text-lg font-black ${
                          match.winner_id ? "text-green-300" : "text-white"
                        }`}
                      >
                        {match.winner_id ? winnerName : "Not selected yet"}
                      </p>
                    </div>

                    <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                      <Link
                        href="/admin/tournaments"
                        className="rounded-lg bg-red-600 px-4 py-3 text-center text-sm font-bold text-white hover:bg-red-700"
                      >
                        Manage Winner
                      </Link>

                      <Link
                        href="/brackets"
                        className="rounded-lg border border-zinc-700 px-4 py-3 text-center text-sm font-bold text-white hover:bg-zinc-800"
                      >
                        View Public Bracket
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}