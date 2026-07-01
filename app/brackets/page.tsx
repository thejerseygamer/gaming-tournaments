"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { checkIsAdmin } from "../lib/admin";

type Tournament = {
  id: string;
  name: string;
  game: string | null;
  platform: string | null;
  start_time: string | null;
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
  score_submitted_at: string | null;
  score_proof_path: string | null;
  created_at: string;
};

type MatchEdit = {
  player1_score: string;
  player2_score: string;
};

function buildMatchEdits(loadedMatches: Match[]) {
  return loadedMatches.reduce((acc, match) => {
    acc[match.id] = {
      player1_score:
        match.player1_score === null || match.player1_score === undefined
          ? ""
          : String(match.player1_score),
      player2_score:
        match.player2_score === null || match.player2_score === undefined
          ? ""
          : String(match.player2_score),
    };

    return acc;
  }, {} as Record<string, MatchEdit>);
}

function parseScore(value: string) {
  if (!value.trim()) return null;

  const parsedValue = Number.parseInt(value, 10);

  if (Number.isNaN(parsedValue)) return null;

  return parsedValue;
}

function formatDateTime(value: string | null) {
  if (!value) return "Not set";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not set";

  return date.toLocaleString();
}

export default function BracketsPage() {
  const [isAdmin, setIsAdmin] = useState(false);

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [playerRows, setPlayerRows] = useState<TournamentPlayer[]>([]);
  const [profilesById, setProfilesById] = useState<
    Record<string, PlayerProfile>
  >({});
  const [matches, setMatches] = useState<Match[]>([]);
  const [matchEdits, setMatchEdits] = useState<Record<string, MatchEdit>>({});

  const [selectedTournamentId, setSelectedTournamentId] = useState("");

  const [loading, setLoading] = useState(true);
  const [savingMatchId, setSavingMatchId] = useState("");
  const [settingWinnerId, setSettingWinnerId] = useState("");
  const [clearingWinnerId, setClearingWinnerId] = useState("");
  const [message, setMessage] = useState("");

  const loadBrackets = useCallback(async () => {
    setLoading(true);
    setMessage("");

    const adminCheck = await checkIsAdmin();
    setIsAdmin(Boolean(adminCheck.isAdmin));

    const { data: tournamentData, error: tournamentError } = await supabase
      .from("tournaments")
      .select(
        "id, name, game, platform, start_time, registration_open, created_at"
      )
      .order("created_at", { ascending: false });

    if (tournamentError) {
      setMessage(`Error loading tournaments: ${tournamentError.message}`);
      setTournaments([]);
      setPlayerRows([]);
      setProfilesById({});
      setMatches([]);
      setMatchEdits({});
      setLoading(false);
      return;
    }

    const loadedTournaments = (tournamentData || []) as Tournament[];
    const tournamentIds = loadedTournaments.map((tournament) => tournament.id);

    setTournaments(loadedTournaments);

    const tournamentFromUrl =
      typeof window === "undefined"
        ? ""
        : new URLSearchParams(window.location.search).get("tournament") || "";

    setSelectedTournamentId((currentSelectedTournamentId) => {
      const urlTournamentExists = loadedTournaments.some(
        (tournament) => tournament.id === tournamentFromUrl
      );

      if (tournamentFromUrl && urlTournamentExists) {
        return tournamentFromUrl;
      }

      const currentTournamentExists = loadedTournaments.some(
        (tournament) => tournament.id === currentSelectedTournamentId
      );

      if (currentSelectedTournamentId && currentTournamentExists) {
        return currentSelectedTournamentId;
      }

      return loadedTournaments[0]?.id || "";
    });

    if (tournamentIds.length === 0) {
      setPlayerRows([]);
      setProfilesById({});
      setMatches([]);
      setMatchEdits({});
      setLoading(false);
      return;
    }

    const { data: playerData, error: playerError } = await supabase
      .from("tournament_players")
      .select("tournament_id, player_id")
      .in("tournament_id", tournamentIds);

    if (playerError) {
      setMessage(`Error loading tournament players: ${playerError.message}`);
      setPlayerRows([]);
    }

    const loadedPlayerRows = (playerData || []) as TournamentPlayer[];

    setPlayerRows(loadedPlayerRows);

    const { data: matchData, error: matchError } = await supabase
      .from("matches")
      .select(
        "id, tournament_id, round, match_number, player1_id, player2_id, winner_id, status, player1_score, player2_score, score_submitted_by, score_submitted_at, score_proof_path, created_at"
      )
      .in("tournament_id", tournamentIds)
      .order("round", { ascending: true })
      .order("match_number", { ascending: true });

    if (matchError) {
      setMessage(`Error loading matches: ${matchError.message}`);
      setMatches([]);
      setMatchEdits({});
      setLoading(false);
      return;
    }

    const loadedMatches = (matchData || []) as Match[];

    setMatches(loadedMatches);
    setMatchEdits(buildMatchEdits(loadedMatches));

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
        setMessage(`Error loading player names: ${profileError.message}`);
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
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadBrackets();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadBrackets]);

  const selectedTournament = useMemo(() => {
    return (
      tournaments.find((tournament) => tournament.id === selectedTournamentId) ||
      null
    );
  }, [selectedTournamentId, tournaments]);

  const selectedMatches = useMemo(() => {
    return matches
      .filter((match) => match.tournament_id === selectedTournamentId)
      .sort((a, b) => {
        return a.round - b.round || a.match_number - b.match_number;
      });
  }, [matches, selectedTournamentId]);

  const rounds = useMemo(() => {
    return Array.from(new Set(selectedMatches.map((match) => match.round))).sort(
      (a, b) => a - b
    );
  }, [selectedMatches]);

  const selectedPlayerCount = useMemo(() => {
    return playerRows.filter((row) => row.tournament_id === selectedTournamentId)
      .length;
  }, [playerRows, selectedTournamentId]);

  const completedMatchCount = useMemo(() => {
    return selectedMatches.filter((match) => match.status === "completed")
      .length;
  }, [selectedMatches]);

  const pendingReviewCount = useMemo(() => {
    return selectedMatches.filter(
      (match) => match.status === "pending" && match.score_submitted_by
    ).length;
  }, [selectedMatches]);

  function handleTournamentChange(tournamentId: string) {
    setSelectedTournamentId(tournamentId);

    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);

      if (tournamentId) {
        url.searchParams.set("tournament", tournamentId);
      } else {
        url.searchParams.delete("tournament");
      }

      window.history.replaceState(null, "", url.toString());
    }
  }

  function playerName(playerId: string | null) {
    if (!playerId) return "TBD";

    return profilesById[playerId]?.gamer_tag || "Unnamed Player";
  }

  function matchStatusLabel(match: Match) {
    if (match.status === "completed") return "Completed";
    if (match.score_submitted_by) return "Pending Review";

    return "Pending";
  }

  function matchStatusClass(match: Match) {
    if (match.status === "completed") {
      return "border-green-700 bg-green-950/40 text-green-300";
    }

    if (match.score_submitted_by) {
      return "border-yellow-700 bg-yellow-950/40 text-yellow-300";
    }

    return "border-gray-700 bg-black text-gray-300";
  }

  function scoreText(match: Match) {
    if (
      match.player1_score === null ||
      match.player1_score === undefined ||
      match.player2_score === null ||
      match.player2_score === undefined
    ) {
      return "No score submitted";
    }

    return `${match.player1_score} - ${match.player2_score}`;
  }

  function proofUrl(path: string) {
    const { data } = supabase.storage.from("match-proofs").getPublicUrl(path);

    return data.publicUrl;
  }

  function updateMatchEdit(
    matchId: string,
    field: keyof MatchEdit,
    value: string
  ) {
    setMatchEdits((currentMatchEdits) => ({
      ...currentMatchEdits,
      [matchId]: {
        ...(currentMatchEdits[matchId] || {
          player1_score: "",
          player2_score: "",
        }),
        [field]: value,
      },
    }));
  }

  async function saveScores(match: Match) {
    if (!isAdmin) {
      setMessage("Only admins can save scores.");
      return;
    }

    const edit = matchEdits[match.id];

    if (!edit) {
      setMessage("Score fields are not ready yet.");
      return;
    }

    const player1Score = parseScore(edit.player1_score);
    const player2Score = parseScore(edit.player2_score);

    if (
      player1Score !== null &&
      player2Score !== null &&
      player1Score < 0
    ) {
      setMessage("Scores cannot be negative.");
      return;
    }

    if (
      player1Score !== null &&
      player2Score !== null &&
      player2Score < 0
    ) {
      setMessage("Scores cannot be negative.");
      return;
    }

    setSavingMatchId(match.id);
    setMessage("");

    const { error } = await supabase
      .from("matches")
      .update({
        player1_score: player1Score,
        player2_score: player2Score,
      })
      .eq("id", match.id);

    if (error) {
      setMessage(`Error saving scores: ${error.message}`);
      setSavingMatchId("");
      return;
    }

    setMessage("Scores saved.");
    await loadBrackets();
    setSavingMatchId("");
  }

  async function advanceWinner(match: Match, winnerId: string) {
    const nextRound = match.round + 1;
    const nextMatchNumber = Math.ceil(match.match_number / 2);
    const nextSlot = match.match_number % 2 === 1 ? "player1_id" : "player2_id";

    const nextMatch = matches.find(
      (currentMatch) =>
        currentMatch.tournament_id === match.tournament_id &&
        currentMatch.round === nextRound &&
        currentMatch.match_number === nextMatchNumber
    );

    if (!nextMatch || nextMatch.status === "completed") {
      return;
    }

    const { error } = await supabase
      .from("matches")
      .update({
        [nextSlot]: winnerId,
      })
      .eq("id", nextMatch.id);

    if (error) {
      setMessage(
        `Winner was saved, but could not advance automatically: ${error.message}`
      );
    }
  }

  async function setPlayerWins(match: Match, winnerId: string) {
    if (!isAdmin) {
      setMessage("Only admins can set match winners.");
      return;
    }

    if (!match.player1_id || !match.player2_id) {
      setMessage("Both players must be assigned before choosing a winner.");
      return;
    }

    if (winnerId !== match.player1_id && winnerId !== match.player2_id) {
      setMessage("Winner must be one of the players in the match.");
      return;
    }

    const edit = matchEdits[match.id] || {
      player1_score: "",
      player2_score: "",
    };

    const player1Score = parseScore(edit.player1_score);
    const player2Score = parseScore(edit.player2_score);

    if (
      player1Score !== null &&
      player2Score !== null &&
      player1Score === player2Score
    ) {
      setMessage("Scores cannot be tied when choosing a winner.");
      return;
    }

    setSettingWinnerId(`${match.id}-${winnerId}`);
    setMessage("");

    const { error } = await supabase
      .from("matches")
      .update({
        player1_score: player1Score,
        player2_score: player2Score,
        winner_id: winnerId,
        status: "completed",
      })
      .eq("id", match.id);

    if (error) {
      setMessage(`Error setting winner: ${error.message}`);
      setSettingWinnerId("");
      return;
    }

    await advanceWinner(match, winnerId);

    setMessage(`${playerName(winnerId)} was marked as the winner.`);
    await loadBrackets();
    setSettingWinnerId("");
  }

  async function clearWinner(match: Match) {
    if (!isAdmin) {
      setMessage("Only admins can clear winners.");
      return;
    }

    if (!match.winner_id) {
      setMessage("This match does not have a winner yet.");
      return;
    }

    const confirmed = window.confirm(
      `Clear the winner for Round ${match.round}, Match ${match.match_number}?`
    );

    if (!confirmed) return;

    setClearingWinnerId(match.id);
    setMessage("");

    const oldWinnerId = match.winner_id;

    const { error } = await supabase
      .from("matches")
      .update({
        winner_id: null,
        status: "pending",
      })
      .eq("id", match.id);

    if (error) {
      setMessage(`Error clearing winner: ${error.message}`);
      setClearingWinnerId("");
      return;
    }

    const nextRound = match.round + 1;
    const nextMatchNumber = Math.ceil(match.match_number / 2);
    const nextSlot = match.match_number % 2 === 1 ? "player1_id" : "player2_id";

    const nextMatch = matches.find(
      (currentMatch) =>
        currentMatch.tournament_id === match.tournament_id &&
        currentMatch.round === nextRound &&
        currentMatch.match_number === nextMatchNumber
    );

    if (nextMatch && nextMatch.status !== "completed") {
      await supabase
        .from("matches")
        .update({
          [nextSlot]: null,
        })
        .eq("id", nextMatch.id)
        .eq(nextSlot, oldWinnerId);
    }

    setMessage("Winner cleared.");
    await loadBrackets();
    setClearingWinnerId("");
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

              <h1 className="mb-3 text-4xl font-black">Tournament Brackets</h1>

              <p className="max-w-2xl text-gray-400">
                View tournament matchups, scores, winners, and bracket progress.
                Admin-only score controls are hidden from regular users.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={loadBrackets}
                disabled={loading}
                className="rounded-lg border border-gray-700 px-5 py-3 font-bold text-white hover:bg-gray-900 disabled:opacity-50"
              >
                {loading ? "Refreshing..." : "Refresh"}
              </button>

              <Link
                href="/tournaments"
                className="rounded-lg bg-white px-5 py-3 text-center font-bold text-black hover:bg-gray-200"
              >
                Browse Tournaments
              </Link>
            </div>
          </div>
        </section>

        {message && (
          <p className="mb-6 rounded-lg border border-yellow-800 bg-yellow-950/30 p-4 text-sm text-yellow-200">
            {message}
          </p>
        )}

        {isAdmin && (
          <p className="mb-6 rounded-lg border border-red-800 bg-red-950/30 p-4 text-sm text-red-200">
            Admin mode is active. You can save scores, set winners, and clear
            winners from this page.
          </p>
        )}

        <section className="mb-8 rounded-xl border border-gray-800 bg-gray-950 p-5">
          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <label className="mb-2 block text-sm text-gray-400">
                Select Tournament
              </label>

              <select
                className="w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                value={selectedTournamentId}
                onChange={(event) => handleTournamentChange(event.target.value)}
              >
                {tournaments.length === 0 ? (
                  <option value="">No tournaments found</option>
                ) : (
                  tournaments.map((tournament) => (
                    <option key={tournament.id} value={tournament.id}>
                      {tournament.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            {selectedTournament && (
              <Link
                href={`/tournaments/${selectedTournament.id}`}
                className="rounded-lg border border-gray-700 px-5 py-3 text-center font-bold text-white hover:bg-gray-900"
              >
                Tournament Details
              </Link>
            )}
          </div>
        </section>

        {loading ? (
          <p className="rounded-xl border border-gray-800 bg-gray-950 p-6 text-gray-400">
            Loading brackets...
          </p>
        ) : !selectedTournament ? (
          <section className="rounded-xl border border-gray-800 bg-gray-950 p-6">
            <h2 className="mb-2 text-2xl font-bold">No tournament selected</h2>

            <p className="text-gray-400">
              Create or select a tournament to view its bracket.
            </p>
          </section>
        ) : (
          <>
            <section className="mb-8 rounded-2xl border border-gray-800 bg-gray-950 p-6">
              <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="text-3xl font-black">
                    {selectedTournament.name}
                  </h2>

                  <p className="mt-2 text-gray-400">
                    {selectedTournament.game || "Game not set"} •{" "}
                    {selectedTournament.platform || "Platform not set"}
                  </p>

                  <p className="mt-2 text-sm text-gray-500">
                    Start: {formatDateTime(selectedTournament.start_time)}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-gray-800 bg-black p-4">
                    <p className="text-sm text-gray-500">Players</p>
                    <p className="mt-2 text-3xl font-black">
                      {selectedPlayerCount}
                    </p>
                  </div>

                  <div className="rounded-xl border border-gray-800 bg-black p-4">
                    <p className="text-sm text-gray-500">Matches</p>
                    <p className="mt-2 text-3xl font-black">
                      {selectedMatches.length}
                    </p>
                  </div>

                  <div className="rounded-xl border border-gray-800 bg-black p-4">
                    <p className="text-sm text-gray-500">Completed</p>
                    <p className="mt-2 text-3xl font-black">
                      {completedMatchCount}
                    </p>
                  </div>
                </div>
              </div>

              {pendingReviewCount > 0 && (
                <p className="mt-5 rounded-lg border border-yellow-800 bg-yellow-950/30 p-4 text-sm text-yellow-200">
                  {pendingReviewCount} match submission(s) are waiting for admin
                  review.
                </p>
              )}
            </section>

            {selectedMatches.length === 0 ? (
              <section className="rounded-xl border border-gray-800 bg-gray-950 p-6">
                <h2 className="mb-2 text-2xl font-bold">
                  No bracket generated yet
                </h2>

                <p className="mb-5 text-gray-400">
                  This tournament does not have matches yet. Check back after an
                  admin generates the bracket.
                </p>

                {isAdmin && (
                  <Link
                    href="/admin/tournaments"
                    className="inline-block rounded-lg bg-white px-5 py-3 font-bold text-black hover:bg-gray-200"
                  >
                    Go to Bracket Manager
                  </Link>
                )}
              </section>
            ) : (
              <section className="grid gap-8">
                {rounds.map((round) => (
                  <div
                    key={round}
                    className="rounded-2xl border border-gray-800 bg-gray-950 p-6"
                  >
                    <h2 className="mb-5 text-3xl font-black">Round {round}</h2>

                    <div className="grid gap-5 lg:grid-cols-2">
                      {selectedMatches
                        .filter((match) => match.round === round)
                        .map((match) => {
                          const edit = matchEdits[match.id] || {
                            player1_score: "",
                            player2_score: "",
                          };

                          const player1IsWinner =
                            match.winner_id && match.winner_id === match.player1_id;
                          const player2IsWinner =
                            match.winner_id && match.winner_id === match.player2_id;

                          return (
                            <article
                              key={match.id}
                              className="rounded-xl border border-gray-800 bg-black p-5"
                            >
                              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                  <h3 className="text-2xl font-bold">
                                    Match {match.match_number}
                                  </h3>

                                  <p className="mt-1 text-sm text-gray-500">
                                    Score: {scoreText(match)}
                                  </p>
                                </div>

                                <span
                                  className={`w-fit rounded-full border px-3 py-1 text-xs font-bold ${matchStatusClass(
                                    match
                                  )}`}
                                >
                                  {matchStatusLabel(match)}
                                </span>
                              </div>

                              <div className="mb-5 grid gap-3">
                                <div
                                  className={`rounded-xl border p-4 ${
                                    player1IsWinner
                                      ? "border-green-700 bg-green-950/30"
                                      : "border-gray-800 bg-gray-950"
                                  }`}
                                >
                                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                      <p className="text-xs text-gray-500">
                                        Player 1
                                      </p>

                                      <p className="text-xl font-bold">
                                        {match.player1_id ? (
                                          <Link
                                            href={`/players/${match.player1_id}`}
                                            className="hover:text-red-400"
                                          >
                                            {playerName(match.player1_id)}
                                          </Link>
                                        ) : (
                                          "TBD"
                                        )}
                                      </p>
                                    </div>

                                    {player1IsWinner && (
                                      <span className="w-fit rounded-full border border-green-700 bg-green-950/40 px-3 py-1 text-xs font-bold text-green-300">
                                        Winner
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div
                                  className={`rounded-xl border p-4 ${
                                    player2IsWinner
                                      ? "border-green-700 bg-green-950/30"
                                      : "border-gray-800 bg-gray-950"
                                  }`}
                                >
                                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                      <p className="text-xs text-gray-500">
                                        Player 2
                                      </p>

                                      <p className="text-xl font-bold">
                                        {match.player2_id ? (
                                          <Link
                                            href={`/players/${match.player2_id}`}
                                            className="hover:text-red-400"
                                          >
                                            {playerName(match.player2_id)}
                                          </Link>
                                        ) : (
                                          "TBD"
                                        )}
                                      </p>
                                    </div>

                                    {player2IsWinner && (
                                      <span className="w-fit rounded-full border border-green-700 bg-green-950/40 px-3 py-1 text-xs font-bold text-green-300">
                                        Winner
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {match.score_submitted_by && (
                                <div className="mb-5 rounded-xl border border-yellow-800 bg-yellow-950/20 p-4">
                                  <p className="text-sm font-bold text-yellow-300">
                                    Score submitted by{" "}
                                    {playerName(match.score_submitted_by)}
                                  </p>

                                  <p className="mt-1 text-xs text-gray-500">
                                    {formatDateTime(match.score_submitted_at)}
                                  </p>
                                </div>
                              )}

                              {match.score_proof_path && (
                                <div className="mb-5 overflow-hidden rounded-xl border border-gray-800 bg-gray-950">
                                  <Image
                                    src={proofUrl(match.score_proof_path)}
                                    alt="Score proof screenshot"
                                    width={900}
                                    height={500}
                                    className="h-auto w-full object-cover"
                                  />
                                </div>
                              )}

                              {isAdmin && (
                                <section className="rounded-xl border border-red-900 bg-red-950/10 p-4">
                                  <h4 className="mb-4 text-lg font-bold text-red-200">
                                    Admin Score Controls
                                  </h4>

                                  <div className="mb-4 grid gap-3 sm:grid-cols-2">
                                    <div>
                                      <label className="mb-2 block text-xs text-gray-500">
                                        Player 1 Score
                                      </label>

                                      <input
                                        type="number"
                                        min="0"
                                        className="w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                                        value={edit.player1_score}
                                        onChange={(event) =>
                                          updateMatchEdit(
                                            match.id,
                                            "player1_score",
                                            event.target.value
                                          )
                                        }
                                      />
                                    </div>

                                    <div>
                                      <label className="mb-2 block text-xs text-gray-500">
                                        Player 2 Score
                                      </label>

                                      <input
                                        type="number"
                                        min="0"
                                        className="w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                                        value={edit.player2_score}
                                        onChange={(event) =>
                                          updateMatchEdit(
                                            match.id,
                                            "player2_score",
                                            event.target.value
                                          )
                                        }
                                      />
                                    </div>
                                  </div>

                                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                    <button
                                      type="button"
                                      onClick={() => saveScores(match)}
                                      disabled={savingMatchId === match.id}
                                      className="rounded-lg bg-white px-4 py-3 text-sm font-bold text-black hover:bg-gray-200 disabled:opacity-50"
                                    >
                                      {savingMatchId === match.id
                                        ? "Saving..."
                                        : "Save Scores"}
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        match.player1_id &&
                                        setPlayerWins(match, match.player1_id)
                                      }
                                      disabled={
                                        !match.player1_id ||
                                        !match.player2_id ||
                                        settingWinnerId ===
                                          `${match.id}-${match.player1_id}`
                                      }
                                      className="rounded-lg border border-green-800 px-4 py-3 text-sm font-bold text-green-300 hover:bg-green-950/40 disabled:opacity-50"
                                    >
                                      {settingWinnerId ===
                                      `${match.id}-${match.player1_id}`
                                        ? "Saving..."
                                        : "Player 1 Wins"}
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        match.player2_id &&
                                        setPlayerWins(match, match.player2_id)
                                      }
                                      disabled={
                                        !match.player1_id ||
                                        !match.player2_id ||
                                        settingWinnerId ===
                                          `${match.id}-${match.player2_id}`
                                      }
                                      className="rounded-lg border border-green-800 px-4 py-3 text-sm font-bold text-green-300 hover:bg-green-950/40 disabled:opacity-50"
                                    >
                                      {settingWinnerId ===
                                      `${match.id}-${match.player2_id}`
                                        ? "Saving..."
                                        : "Player 2 Wins"}
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => clearWinner(match)}
                                      disabled={
                                        !match.winner_id ||
                                        clearingWinnerId === match.id
                                      }
                                      className="rounded-lg border border-red-800 px-4 py-3 text-sm font-bold text-red-300 hover:bg-red-950/40 disabled:opacity-50"
                                    >
                                      {clearingWinnerId === match.id
                                        ? "Clearing..."
                                        : "Clear Winner"}
                                    </button>
                                  </div>

                                  {match.score_submitted_by && (
                                    <Link
                                      href="/admin/reviews"
                                      className="mt-3 block rounded-lg border border-yellow-800 px-4 py-3 text-center text-sm font-bold text-yellow-300 hover:bg-yellow-950/40"
                                    >
                                      Open Score Review Queue
                                    </Link>
                                  )}
                                </section>
                              )}
                            </article>
                          );
                        })}
                    </div>
                  </div>
                ))}
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}