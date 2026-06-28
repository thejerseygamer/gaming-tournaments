"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Tournament = {
  id: string;
  name: string;
  game: string | null;
  platform: string | null;
  registration_open: boolean;
  max_players: number | null;
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
  player1_score: number | null;
  player2_score: number | null;
  score_submitted_by: string | null;
  score_submitted_at: string | null;
  status: string | null;
};

type PlayerProfile = {
  id: string;
  gamer_tag: string | null;
  platform: string | null;
  favorite_team: string | null;
};

export default function BracketsPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState("");
  const [matches, setMatches] = useState<Match[]>([]);
  const [profiles, setProfiles] = useState<Record<string, PlayerProfile>>({});
  const [loadingTournaments, setLoadingTournaments] = useState(true);
  const [loadingBracket, setLoadingBracket] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadTournaments() {
      const { data, error } = await supabase
        .from("tournaments")
        .select(
          "id, name, game, platform, registration_open, max_players, created_at"
        )
        .order("created_at", { ascending: false });

      if (!isMounted) return;

      if (error) {
        setMessage(`Error loading tournaments: ${error.message}`);
        setTournaments([]);
        setLoadingTournaments(false);
        return;
      }

      const loadedTournaments = (data || []) as Tournament[];

      setTournaments(loadedTournaments);

      const searchParams = new URLSearchParams(window.location.search);
      const tournamentIdFromUrl = searchParams.get("tournament");

      const validUrlTournament = loadedTournaments.find(
        (tournament) => tournament.id === tournamentIdFromUrl
      );

      if (validUrlTournament) {
        setSelectedTournamentId(validUrlTournament.id);
      } else if (loadedTournaments.length > 0) {
        setSelectedTournamentId(loadedTournaments[0].id);
      }

      setLoadingTournaments(false);
    }

    loadTournaments();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedTournamentId) return;

    let isMounted = true;

    async function loadBracket() {
      setLoadingBracket(true);
      setMessage("");

      const { data: matchData, error: matchError } = await supabase
        .from("matches")
        .select("*")
        .eq("tournament_id", selectedTournamentId)
        .order("round", { ascending: true })
        .order("match_number", { ascending: true });

      if (!isMounted) return;

      if (matchError) {
        setMessage(`Error loading bracket: ${matchError.message}`);
        setMatches([]);
        setProfiles({});
        setLoadingBracket(false);
        return;
      }

      const loadedMatches = (matchData || []) as Match[];

      setMatches(loadedMatches);

      const playerIds = Array.from(
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

      if (playerIds.length === 0) {
        setProfiles({});
        setLoadingBracket(false);
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, gamer_tag, platform, favorite_team")
        .in("id", playerIds);

      if (!isMounted) return;

      if (profileError) {
        setMessage(`Error loading player names: ${profileError.message}`);
        setProfiles({});
        setLoadingBracket(false);
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
      setLoadingBracket(false);
    }

    loadBracket();

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

  const rounds = useMemo(() => {
    const grouped: Record<number, Match[]> = {};

    for (const match of matches) {
      if (!grouped[match.round]) {
        grouped[match.round] = [];
      }

      grouped[match.round].push(match);
    }

    return Object.entries(grouped)
      .map(([round, roundMatches]) => ({
        round: Number(round),
        matches: roundMatches.sort((a, b) => a.match_number - b.match_number),
      }))
      .sort((a, b) => a.round - b.round);
  }, [matches]);

  const bracketGenerated = matches.length > 0;

  function playerName(playerId: string | null) {
    if (!playerId) return "TBD";

    return profiles[playerId]?.gamer_tag || "Unnamed Player";
  }

  function formatDisplayDate(value: string | null) {
    if (!value) return "Not set";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "Not set";

    return date.toLocaleString();
  }

  function getRoundName(round: number, totalRounds: number) {
    if (totalRounds === 1) return "Final";
    if (round === totalRounds) return "Final";
    if (round === totalRounds - 1) return "Semifinals";
    if (round === totalRounds - 2) return "Quarterfinals";

    return `Round ${round}`;
  }

  function getMatchStatusLabel(match: Match) {
    if (match.status === "completed") return "Completed";

    if (match.score_submitted_by && match.score_submitted_at) {
      return "Pending Review";
    }

    return "Pending";
  }

  function getMatchStatusClass(match: Match) {
    if (match.status === "completed") {
      return "border-green-700 bg-green-950/40 text-green-300";
    }

    if (match.score_submitted_by && match.score_submitted_at) {
      return "border-yellow-700 bg-yellow-950/40 text-yellow-300";
    }

    return "border-gray-700 bg-gray-950 text-gray-300";
  }

  function getScoreSubmittedText(match: Match) {
    if (!match.score_submitted_by || !match.score_submitted_at) {
      return "";
    }

    return `Score submitted by ${playerName(
      match.score_submitted_by
    )} on ${formatDisplayDate(match.score_submitted_at)}.`;
  }

  function getPlayerRowClass(match: Match, playerId: string | null) {
    if (!playerId) {
      return "border-gray-800 bg-gray-950 text-gray-500";
    }

    if (match.winner_id === playerId) {
      return "border-green-700 bg-green-950/40 text-green-300";
    }

    if (match.status === "completed" && match.winner_id !== playerId) {
      return "border-red-900 bg-red-950/30 text-red-300";
    }

    return "border-gray-700 bg-black text-white";
  }

  function handleTournamentChange(tournamentId: string) {
    setSelectedTournamentId(tournamentId);

    const newUrl = `/brackets?tournament=${tournamentId}`;
    window.history.pushState({}, "", newUrl);
  }

  return (
    <main className="min-h-screen bg-black p-6 text-white">
      <div className="mx-auto max-w-7xl">
        <section className="mb-8 rounded-2xl border border-gray-800 bg-gray-950 p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="mb-3 text-sm font-bold uppercase tracking-[0.25em] text-red-500">
                BattleGrid Brackets
              </p>

              <h1 className="mb-3 text-4xl font-black">Bracket Viewer</h1>

              <p className="max-w-2xl text-gray-400">
                View tournament matchups, submitted scores, official winners,
                byes, and future rounds.
              </p>
            </div>

            <Link
              href="/tournaments"
              className="rounded-lg border border-gray-700 px-5 py-3 text-center font-bold text-white hover:bg-gray-900"
            >
              Browse Tournaments
            </Link>
          </div>
        </section>

        {message && (
          <p className="mb-6 rounded-lg border border-red-900 bg-red-950/40 p-4 text-sm text-red-200">
            {message}
          </p>
        )}

        {loadingTournaments ? (
          <p className="rounded-xl border border-gray-800 bg-gray-950 p-6 text-gray-400">
            Loading tournaments...
          </p>
        ) : tournaments.length === 0 ? (
          <section className="rounded-xl border border-gray-800 bg-gray-950 p-6">
            <h2 className="mb-2 text-2xl font-bold">No tournaments found</h2>

            <p className="text-gray-400">
              Brackets will appear here after tournaments are created.
            </p>
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
                onChange={(e) => handleTournamentChange(e.target.value)}
              >
                {tournaments.map((tournament) => (
                  <option key={tournament.id} value={tournament.id}>
                    {tournament.name}
                  </option>
                ))}
              </select>
            </section>

            {selectedTournament && (
              <section className="mb-6 rounded-xl border border-gray-800 bg-gray-950 p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h2 className="text-2xl font-bold">
                      {selectedTournament.name}
                    </h2>

                    <p className="mt-1 text-sm text-gray-400">
                      {selectedTournament.game || "Game not set"} •{" "}
                      {selectedTournament.platform || "Platform not set"}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span
                      className={`w-fit rounded-full border px-3 py-1 text-xs font-bold ${
                        bracketGenerated
                          ? "border-yellow-700 bg-yellow-950/40 text-yellow-300"
                          : "border-gray-700 bg-black text-gray-300"
                      }`}
                    >
                      {bracketGenerated ? "Bracket Generated" : "No Bracket Yet"}
                    </span>

                    <span
                      className={`w-fit rounded-full border px-3 py-1 text-xs font-bold ${
                        bracketGenerated
                          ? "border-yellow-700 bg-yellow-950/40 text-yellow-300"
                          : selectedTournament.registration_open
                          ? "border-green-700 bg-green-950/40 text-green-300"
                          : "border-red-700 bg-red-950/40 text-red-300"
                      }`}
                    >
                      {bracketGenerated
                        ? "Registration Locked"
                        : selectedTournament.registration_open
                        ? "Registration Open"
                        : "Registration Closed"}
                    </span>
                  </div>
                </div>
              </section>
            )}

            {loadingBracket ? (
              <p className="rounded-xl border border-gray-800 bg-gray-950 p-6 text-gray-400">
                Loading bracket...
              </p>
            ) : !bracketGenerated ? (
              <section className="rounded-xl border border-gray-800 bg-gray-950 p-6">
                <h2 className="mb-2 text-2xl font-bold">
                  No bracket generated yet
                </h2>

                <p className="mb-5 text-gray-400">
                  Once an admin generates the bracket, matchups will appear here.
                </p>

                {selectedTournament && (
                  <Link
                    href={`/tournaments/${selectedTournament.id}`}
                    className="inline-block rounded-lg bg-white px-5 py-3 font-bold text-black hover:bg-gray-200"
                  >
                    View Tournament
                  </Link>
                )}
              </section>
            ) : (
              <section className="overflow-x-auto rounded-xl border border-gray-800 bg-gray-950 p-5">
                <div className="flex min-w-max gap-5">
                  {rounds.map((roundGroup) => (
                    <div key={roundGroup.round} className="w-80 shrink-0">
                      <div className="mb-4 rounded-lg border border-gray-800 bg-black p-4">
                        <h2 className="text-xl font-bold">
                          {getRoundName(roundGroup.round, rounds.length)}
                        </h2>

                        <p className="mt-1 text-sm text-gray-500">
                          {roundGroup.matches.length} match
                          {roundGroup.matches.length === 1 ? "" : "es"}
                        </p>
                      </div>

                      <div className="grid gap-4">
                        {roundGroup.matches.map((match) => (
                          <div
                            key={match.id}
                            className="rounded-xl border border-gray-800 bg-black p-4"
                          >
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <p className="font-bold">
                                Match {match.match_number}
                              </p>

                              <span
                                className={`rounded-full border px-3 py-1 text-xs font-bold ${getMatchStatusClass(
                                  match
                                )}`}
                              >
                                {getMatchStatusLabel(match)}
                              </span>
                            </div>

                            <div className="grid gap-2">
                              <div
                                className={`rounded-lg border p-3 ${getPlayerRowClass(
                                  match,
                                  match.player1_id
                                )}`}
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <span className="font-bold">
                                    {playerName(match.player1_id)}
                                  </span>

                                  <span className="text-sm">
                                    {match.player1_score ?? "-"}
                                  </span>
                                </div>
                              </div>

                              <div
                                className={`rounded-lg border p-3 ${getPlayerRowClass(
                                  match,
                                  match.player2_id
                                )}`}
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <span className="font-bold">
                                    {playerName(match.player2_id)}
                                  </span>

                                  <span className="text-sm">
                                    {match.player2_score ?? "-"}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {match.score_submitted_by &&
                              match.score_submitted_at &&
                              match.status !== "completed" && (
                                <p className="mt-3 rounded-lg border border-yellow-800 bg-yellow-950/30 p-2 text-xs text-yellow-300">
                                  {getScoreSubmittedText(match)}
                                </p>
                              )}

                            {match.winner_id && (
                              <p className="mt-3 rounded-lg border border-green-800 bg-green-950/30 p-2 text-sm text-green-300">
                                Official Winner: {playerName(match.winner_id)}
                              </p>
                            )}

                            {!match.player2_id && match.winner_id && (
                              <p className="mt-2 text-xs text-gray-500">
                                Bye advanced this player automatically.
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}