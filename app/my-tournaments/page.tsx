"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type TournamentPlayer = {
  tournament_id: string;
  player_id: string;
};

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

type PlayerProfile = {
  id: string;
  gamer_tag: string | null;
  platform: string | null;
  favorite_team: string | null;
};

type ScoreDraft = {
  player1_score: string;
  player2_score: string;
  proof_file: File | null;
};

function formatDateTime(value: string | null) {
  if (!value) return "Not set";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not set";

  return date.toLocaleString();
}

function scoreValue(value: string) {
  if (!value.trim()) return null;

  const parsedValue = Number.parseInt(value, 10);

  if (Number.isNaN(parsedValue)) return null;

  return parsedValue;
}

export default function MyTournamentsPage() {
  const router = useRouter();

  const [userId, setUserId] = useState("");
  const [joinedRows, setJoinedRows] = useState<TournamentPlayer[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [profilesById, setProfilesById] = useState<
    Record<string, PlayerProfile>
  >({});
  const [scoreDrafts, setScoreDrafts] = useState<Record<string, ScoreDraft>>({});

  const [selectedTournamentId, setSelectedTournamentId] = useState("");
  const [loading, setLoading] = useState(true);
  const [submittingMatchId, setSubmittingMatchId] = useState("");
  const [leavingTournamentId, setLeavingTournamentId] = useState("");
  const [message, setMessage] = useState("");

  const loadMyTournaments = useCallback(async () => {
    setLoading(true);
    setMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      router.push("/login");
      return;
    }

    setUserId(user.id);

    const { data: joinedData, error: joinedError } = await supabase
      .from("tournament_players")
      .select("tournament_id, player_id")
      .eq("player_id", user.id);

    if (joinedError) {
      setMessage(`Error loading joined tournaments: ${joinedError.message}`);
      setJoinedRows([]);
      setTournaments([]);
      setMatches([]);
      setProfilesById({});
      setLoading(false);
      return;
    }

    const loadedJoinedRows = (joinedData || []) as TournamentPlayer[];
    const tournamentIds = loadedJoinedRows.map((row) => row.tournament_id);

    setJoinedRows(loadedJoinedRows);

    if (tournamentIds.length === 0) {
      setTournaments([]);
      setMatches([]);
      setProfilesById({});
      setScoreDrafts({});
      setSelectedTournamentId("");
      setLoading(false);
      return;
    }

    const { data: tournamentData, error: tournamentError } = await supabase
      .from("tournaments")
      .select(
        "id, name, game, platform, description, rules, start_time, prize_pool, entry_fee, max_players, registration_open, created_at"
      )
      .in("id", tournamentIds)
      .order("created_at", { ascending: false });

    if (tournamentError) {
      setMessage(`Error loading tournaments: ${tournamentError.message}`);
      setTournaments([]);
      setMatches([]);
      setProfilesById({});
      setLoading(false);
      return;
    }

    const loadedTournaments = (tournamentData || []) as Tournament[];

    setTournaments(loadedTournaments);

    setSelectedTournamentId((currentSelectedTournamentId) => {
      const currentStillExists = loadedTournaments.some(
        (tournament) => tournament.id === currentSelectedTournamentId
      );

      if (currentSelectedTournamentId && currentStillExists) {
        return currentSelectedTournamentId;
      }

      return loadedTournaments[0]?.id || "";
    });

    const { data: matchData, error: matchError } = await supabase
      .from("matches")
      .select(
        "id, tournament_id, round, match_number, player1_id, player2_id, winner_id, status, player1_score, player2_score, score_submitted_by, score_submitted_at, score_proof_path, created_at"
      )
      .in("tournament_id", tournamentIds)
      .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)
      .order("round", { ascending: true })
      .order("match_number", { ascending: true });

    if (matchError) {
      setMessage(`Error loading matches: ${matchError.message}`);
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

    const drafts = loadedMatches.reduce((acc, match) => {
      acc[match.id] = {
        player1_score:
          match.player1_score === null || match.player1_score === undefined
            ? ""
            : String(match.player1_score),
        player2_score:
          match.player2_score === null || match.player2_score === undefined
            ? ""
            : String(match.player2_score),
        proof_file: null,
      };

      return acc;
    }, {} as Record<string, ScoreDraft>);

    setScoreDrafts(drafts);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadMyTournaments();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadMyTournaments]);

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

  const activeMatches = useMemo(() => {
    return matches.filter((match) => match.status !== "completed").length;
  }, [matches]);

  const completedMatches = useMemo(() => {
    return matches.filter((match) => match.status === "completed").length;
  }, [matches]);

  const pendingSubmissions = useMemo(() => {
    return matches.filter(
      (match) => match.status === "pending" && match.score_submitted_by
    ).length;
  }, [matches]);

  function playerName(playerId: string | null) {
    if (!playerId) return "TBD";

    return profilesById[playerId]?.gamer_tag || "Unnamed Player";
  }

  function opponentName(match: Match) {
    if (match.player1_id === userId) return playerName(match.player2_id);
    if (match.player2_id === userId) return playerName(match.player1_id);

    return "TBD";
  }

  function matchResultText(match: Match) {
    if (match.status !== "completed") {
      if (match.score_submitted_by) return "Pending Review";
      return "Not Completed";
    }

    if (match.winner_id === userId) return "Win";

    return "Loss";
  }

  function matchResultClass(match: Match) {
    if (match.status !== "completed") {
      if (match.score_submitted_by) {
        return "border-yellow-700 bg-yellow-950/40 text-yellow-300";
      }

      return "border-gray-700 bg-black text-gray-300";
    }

    if (match.winner_id === userId) {
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
      return "No score submitted";
    }

    return `${match.player1_score} - ${match.player2_score}`;
  }

  function proofUrl(path: string) {
    const { data } = supabase.storage.from("match-proofs").getPublicUrl(path);

    return data.publicUrl;
  }

  function updateScoreDraft(
    matchId: string,
    field: keyof ScoreDraft,
    value: string | File | null
  ) {
    setScoreDrafts((currentScoreDrafts) => ({
      ...currentScoreDrafts,
      [matchId]: {
        ...(currentScoreDrafts[matchId] || {
          player1_score: "",
          player2_score: "",
          proof_file: null,
        }),
        [field]: value,
      },
    }));
  }

  async function uploadProof(matchId: string, file: File) {
    if (!userId) {
      throw new Error("You must be logged in to upload proof.");
    }

    const fileExtension = file.name.split(".").pop() || "png";
    const cleanExtension = fileExtension.toLowerCase();
    const filePath = `${userId}/${matchId}-${Date.now()}.${cleanExtension}`;

    const { error } = await supabase.storage
      .from("match-proofs")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: true,
      });

    if (error) {
      throw new Error(error.message);
    }

    return filePath;
  }

  async function submitScore(match: Match) {
    if (!userId) {
      router.push("/login");
      return;
    }

    if (match.status === "completed") {
      setMessage("This match is already completed.");
      return;
    }

    if (match.player1_id !== userId && match.player2_id !== userId) {
      setMessage("You can only submit scores for your own matches.");
      return;
    }

    if (!match.player1_id || !match.player2_id) {
      setMessage("Both players must be assigned before submitting a score.");
      return;
    }

    const draft = scoreDrafts[match.id];

    if (!draft) {
      setMessage("Score fields are not ready yet.");
      return;
    }

    const player1Score = scoreValue(draft.player1_score);
    const player2Score = scoreValue(draft.player2_score);

    if (player1Score === null || player2Score === null) {
      setMessage("Enter both player scores before submitting.");
      return;
    }

    if (player1Score < 0 || player2Score < 0) {
      setMessage("Scores cannot be negative.");
      return;
    }

    if (player1Score === player2Score) {
      setMessage("Scores cannot be tied.");
      return;
    }

    const confirmed = window.confirm(
      `Submit score ${player1Score}-${player2Score} for Round ${match.round}, Match ${match.match_number}?`
    );

    if (!confirmed) return;

    setSubmittingMatchId(match.id);
    setMessage("");

    let proofPath = match.score_proof_path;

    if (draft.proof_file) {
      try {
        proofPath = await uploadProof(match.id, draft.proof_file);
      } catch (error) {
        const uploadError =
          error instanceof Error ? error.message : "Unknown upload error";

        setMessage(`Error uploading proof: ${uploadError}`);
        setSubmittingMatchId("");
        return;
      }
    }

    const { error } = await supabase
      .from("matches")
      .update({
        player1_score: player1Score,
        player2_score: player2Score,
        score_submitted_by: userId,
        score_submitted_at: new Date().toISOString(),
        score_proof_path: proofPath,
        status: "pending",
      })
      .eq("id", match.id);

    if (error) {
      setMessage(`Error submitting score: ${error.message}`);
      setSubmittingMatchId("");
      return;
    }

    setMessage("Score submitted for admin review.");
    await loadMyTournaments();
    setSubmittingMatchId("");
  }

  async function leaveTournament(tournament: Tournament) {
    if (!userId) {
      router.push("/login");
      return;
    }

    const tournamentHasMatches = matches.some(
      (match) => match.tournament_id === tournament.id
    );

    if (tournamentHasMatches) {
      setMessage(
        "You cannot leave after the bracket has been generated. Contact an admin if you need help."
      );
      return;
    }

    const confirmed = window.confirm(
      `Leave "${tournament.name}"? You can join again later if registration is still open.`
    );

    if (!confirmed) return;

    setLeavingTournamentId(tournament.id);
    setMessage("");

    const { error } = await supabase
      .from("tournament_players")
      .delete()
      .eq("tournament_id", tournament.id)
      .eq("player_id", userId);

    if (error) {
      setMessage(`Error leaving tournament: ${error.message}`);
      setLeavingTournamentId("");
      return;
    }

    setMessage(`You left "${tournament.name}".`);
    await loadMyTournaments();
    setLeavingTournamentId("");
  }

  return (
    <main className="min-h-screen bg-black p-6 text-white">
      <div className="mx-auto max-w-7xl">
        <section className="mb-8 rounded-2xl border border-gray-800 bg-gray-950 p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="mb-3 text-sm font-bold uppercase tracking-[0.25em] text-red-500">
                Player Dashboard
              </p>

              <h1 className="mb-3 text-4xl font-black">My Tournaments</h1>

              <p className="max-w-2xl text-gray-400">
                Track tournaments you joined, view your matches, submit scores,
                and upload proof screenshots for review.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={loadMyTournaments}
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

        <section className="mb-8 grid gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-gray-800 bg-gray-950 p-5">
            <p className="text-sm text-gray-500">Joined</p>
            <p className="mt-2 text-4xl font-black">{joinedRows.length}</p>
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-950 p-5">
            <p className="text-sm text-gray-500">My Matches</p>
            <p className="mt-2 text-4xl font-black">{matches.length}</p>
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-950 p-5">
            <p className="text-sm text-gray-500">Active Matches</p>
            <p className="mt-2 text-4xl font-black">{activeMatches}</p>
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-950 p-5">
            <p className="text-sm text-gray-500">Pending Review</p>
            <p className="mt-2 text-4xl font-black">{pendingSubmissions}</p>
          </div>
        </section>

        {loading ? (
          <p className="rounded-xl border border-gray-800 bg-gray-950 p-6 text-gray-400">
            Loading your tournaments...
          </p>
        ) : tournaments.length === 0 ? (
          <section className="rounded-xl border border-gray-800 bg-gray-950 p-6">
            <h2 className="mb-2 text-2xl font-bold">
              You have not joined any tournaments yet
            </h2>

            <p className="mb-5 text-gray-400">
              Browse open tournaments and join one to start competing.
            </p>

            <Link
              href="/tournaments"
              className="inline-block rounded-lg bg-white px-5 py-3 font-bold text-black hover:bg-gray-200"
            >
              Browse Tournaments
            </Link>
          </section>
        ) : (
          <section className="grid gap-6 lg:grid-cols-[420px_1fr]">
            <aside className="rounded-xl border border-gray-800 bg-gray-950 p-5">
              <h2 className="mb-4 text-2xl font-bold">Joined Tournaments</h2>

              <div className="grid gap-4">
                {tournaments.map((tournament) => {
                  const tournamentHasMatches = matches.some(
                    (match) => match.tournament_id === tournament.id
                  );

                  return (
                    <div
                      key={tournament.id}
                      className={`rounded-xl border p-4 ${
                        selectedTournamentId === tournament.id
                          ? "border-red-700 bg-red-950/20"
                          : "border-gray-800 bg-black"
                      }`}
                    >
                      <div className="mb-3">
                        <h3 className="text-xl font-bold">
                          {tournament.name}
                        </h3>

                        <p className="mt-1 text-sm text-gray-500">
                          {tournament.game || "Game not set"} •{" "}
                          {tournament.platform || "Platform not set"}
                        </p>
                      </div>

                      <div className="mb-4 grid gap-1 text-sm text-gray-300">
                        <p>
                          <span className="text-gray-500">Start:</span>{" "}
                          {formatDateTime(tournament.start_time)}
                        </p>

                        <p>
                          <span className="text-gray-500">Prize:</span> $
                          {tournament.prize_pool || 0}
                        </p>

                        <p>
                          <span className="text-gray-500">Entry:</span> $
                          {tournament.entry_fee || 0}
                        </p>

                        <p>
                          <span className="text-gray-500">Bracket:</span>{" "}
                          {tournamentHasMatches ? "Generated" : "Not generated"}
                        </p>
                      </div>

                      <div className="grid gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedTournamentId(tournament.id)}
                          className="rounded-lg bg-white px-4 py-3 text-sm font-bold text-black hover:bg-gray-200"
                        >
                          View My Matches
                        </button>

                        <div className="grid gap-2 sm:grid-cols-2">
                          <Link
                            href={`/tournaments/${tournament.id}`}
                            className="rounded-lg border border-gray-700 px-4 py-3 text-center text-sm font-bold text-white hover:bg-gray-900"
                          >
                            Details
                          </Link>

                          <Link
                            href={`/brackets?tournament=${tournament.id}`}
                            className="rounded-lg border border-gray-700 px-4 py-3 text-center text-sm font-bold text-white hover:bg-gray-900"
                          >
                            Bracket
                          </Link>
                        </div>

                        <button
                          type="button"
                          onClick={() => leaveTournament(tournament)}
                          disabled={
                            tournamentHasMatches ||
                            leavingTournamentId === tournament.id
                          }
                          className="rounded-lg border border-red-800 px-4 py-3 text-sm font-bold text-red-300 hover:bg-red-950/40 disabled:opacity-50"
                        >
                          {leavingTournamentId === tournament.id
                            ? "Leaving..."
                            : tournamentHasMatches
                              ? "Locked"
                              : "Leave Tournament"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </aside>

            <section className="rounded-xl border border-gray-800 bg-gray-950 p-5">
              {!selectedTournament ? (
                <p className="rounded-lg border border-gray-800 bg-black p-4 text-gray-400">
                  Select a tournament to view your matches.
                </p>
              ) : (
                <>
                  <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h2 className="text-3xl font-black">
                        {selectedTournament.name}
                      </h2>

                      <p className="mt-2 text-gray-400">
                        {selectedTournament.game || "Game not set"} •{" "}
                        {selectedTournament.platform || "Platform not set"}
                      </p>
                    </div>

                    <Link
                      href={`/brackets?tournament=${selectedTournament.id}`}
                      className="rounded-lg bg-white px-5 py-3 text-center font-bold text-black hover:bg-gray-200"
                    >
                      View Full Bracket
                    </Link>
                  </div>

                  {selectedMatches.length === 0 ? (
                    <section className="rounded-xl border border-gray-800 bg-black p-5">
                      <h3 className="mb-2 text-2xl font-bold">
                        No matches assigned yet
                      </h3>

                      <p className="text-gray-400">
                        Your matches will appear here after an admin generates
                        the bracket.
                      </p>
                    </section>
                  ) : (
                    <div className="grid gap-5">
                      {selectedMatches.map((match) => {
                        const draft = scoreDrafts[match.id] || {
                          player1_score: "",
                          player2_score: "",
                          proof_file: null,
                        };

                        return (
                          <article
                            key={match.id}
                            className="rounded-xl border border-gray-800 bg-black p-5"
                          >
                            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <h3 className="text-2xl font-bold">
                                  Round {match.round}, Match{" "}
                                  {match.match_number}
                                </h3>

                                <p className="mt-1 text-sm text-gray-500">
                                  Opponent: {opponentName(match)}
                                </p>
                              </div>

                              <span
                                className={`w-fit rounded-full border px-3 py-1 text-xs font-bold ${matchResultClass(
                                  match
                                )}`}
                              >
                                {matchResultText(match)}
                              </span>
                            </div>

                            <div className="mb-5 grid gap-3 md:grid-cols-2">
                              <div
                                className={`rounded-xl border p-4 ${
                                  match.winner_id === match.player1_id
                                    ? "border-green-700 bg-green-950/30"
                                    : "border-gray-800 bg-gray-950"
                                }`}
                              >
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

                              <div
                                className={`rounded-xl border p-4 ${
                                  match.winner_id === match.player2_id
                                    ? "border-green-700 bg-green-950/30"
                                    : "border-gray-800 bg-gray-950"
                                }`}
                              >
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
                            </div>

                            <div className="mb-5 rounded-xl border border-gray-800 bg-gray-950 p-4">
                              <p className="text-sm text-gray-500">
                                Current Score
                              </p>

                              <p className="mt-1 text-2xl font-black">
                                {scoreText(match)}
                              </p>

                              {match.score_submitted_by && (
                                <p className="mt-2 text-sm text-yellow-300">
                                  Submitted by{" "}
                                  {playerName(match.score_submitted_by)} on{" "}
                                  {formatDateTime(match.score_submitted_at)}
                                </p>
                              )}
                            </div>

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

                            {match.status === "completed" ? (
                              <p className="rounded-xl border border-green-800 bg-green-950/20 p-4 text-sm text-green-300">
                                This match result has been confirmed by an admin.
                              </p>
                            ) : (
                              <section className="rounded-xl border border-red-900 bg-red-950/10 p-4">
                                <h4 className="mb-4 text-lg font-bold text-red-200">
                                  Submit Score For Review
                                </h4>

                                <div className="mb-4 grid gap-3 md:grid-cols-2">
                                  <div>
                                    <label className="mb-2 block text-xs text-gray-500">
                                      Player 1 Score
                                    </label>

                                    <input
                                      type="number"
                                      min="0"
                                      className="w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                                      value={draft.player1_score}
                                      onChange={(event) =>
                                        updateScoreDraft(
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
                                      value={draft.player2_score}
                                      onChange={(event) =>
                                        updateScoreDraft(
                                          match.id,
                                          "player2_score",
                                          event.target.value
                                        )
                                      }
                                    />
                                  </div>
                                </div>

                                <div className="mb-4">
                                  <label className="mb-2 block text-xs text-gray-500">
                                    Proof Screenshot
                                  </label>

                                  <input
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp"
                                    className="w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                                    onChange={(event) =>
                                      updateScoreDraft(
                                        match.id,
                                        "proof_file",
                                        event.target.files?.[0] || null
                                      )
                                    }
                                  />

                                  <p className="mt-2 text-xs text-gray-500">
                                    Accepted: PNG, JPG, or WEBP. Max size is set
                                    by your Supabase storage bucket.
                                  </p>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => submitScore(match)}
                                  disabled={submittingMatchId === match.id}
                                  className="rounded-lg bg-white px-5 py-3 font-bold text-black hover:bg-gray-200 disabled:opacity-50"
                                >
                                  {submittingMatchId === match.id
                                    ? "Submitting..."
                                    : match.score_submitted_by
                                      ? "Resubmit Score"
                                      : "Submit Score"}
                                </button>
                              </section>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  )}

                  {completedMatches > 0 && (
                    <p className="mt-6 rounded-lg border border-green-800 bg-green-950/20 p-4 text-sm text-green-300">
                      You have {completedMatches} completed match(es) across your
                      tournaments.
                    </p>
                  )}
                </>
              )}
            </section>
          </section>
        )}
      </div>
    </main>
  );
}