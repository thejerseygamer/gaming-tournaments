"use client";

import Image from "next/image";
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
  start_time: string | null;
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

type ReviewEdit = {
  winner_id: string;
};

function formatDateTime(value: string | null) {
  if (!value) return "Not set";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not set";

  return date.toLocaleString();
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

function suggestedWinnerId(match: Match) {
  if (
    match.player1_score === null ||
    match.player1_score === undefined ||
    match.player2_score === null ||
    match.player2_score === undefined
  ) {
    return "";
  }

  if (match.player1_score > match.player2_score) {
    return match.player1_id || "";
  }

  if (match.player2_score > match.player1_score) {
    return match.player2_id || "";
  }

  return "";
}

function buildReviewEdits(matches: Match[]) {
  return matches.reduce((acc, match) => {
    acc[match.id] = {
      winner_id: suggestedWinnerId(match),
    };

    return acc;
  }, {} as Record<string, ReviewEdit>);
}

export default function AdminReviewsPage() {
  const router = useRouter();

  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [reviews, setReviews] = useState<Match[]>([]);
  const [allTournamentMatches, setAllTournamentMatches] = useState<Match[]>([]);
  const [tournamentsById, setTournamentsById] = useState<
    Record<string, Tournament>
  >({});
  const [profilesById, setProfilesById] = useState<
    Record<string, PlayerProfile>
  >({});
  const [reviewEdits, setReviewEdits] = useState<Record<string, ReviewEdit>>(
    {}
  );

  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState("");
  const [dismissingId, setDismissingId] = useState("");
  const [message, setMessage] = useState("");

  const loadReviews = useCallback(async () => {
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

    const { data: reviewData, error: reviewError } = await supabase
      .from("matches")
      .select(
        "id, tournament_id, round, match_number, player1_id, player2_id, winner_id, status, player1_score, player2_score, score_submitted_by, score_submitted_at, score_proof_path, created_at"
      )
      .eq("status", "pending")
      .not("score_submitted_by", "is", null)
      .order("score_submitted_at", { ascending: true });

    if (reviewError) {
      setMessage(`Error loading score reviews: ${reviewError.message}`);
      setReviews([]);
      setAllTournamentMatches([]);
      setTournamentsById({});
      setProfilesById({});
      setReviewEdits({});
      setLoading(false);
      return;
    }

    const loadedReviews = (reviewData || []) as Match[];

    setReviews(loadedReviews);
    setReviewEdits(buildReviewEdits(loadedReviews));

    if (loadedReviews.length === 0) {
      setAllTournamentMatches([]);
      setTournamentsById({});
      setProfilesById({});
      setLoading(false);
      return;
    }

    const tournamentIds = Array.from(
      new Set(loadedReviews.map((match) => match.tournament_id))
    );

    const { data: tournamentData, error: tournamentError } = await supabase
      .from("tournaments")
      .select("id, name, game, platform, start_time")
      .in("id", tournamentIds);

    if (tournamentError) {
      setMessage(`Error loading tournaments: ${tournamentError.message}`);
      setTournamentsById({});
    } else {
      const tournamentMap = ((tournamentData || []) as Tournament[]).reduce(
        (acc, tournament) => {
          acc[tournament.id] = tournament;
          return acc;
        },
        {} as Record<string, Tournament>
      );

      setTournamentsById(tournamentMap);
    }

    const { data: matchData, error: matchError } = await supabase
      .from("matches")
      .select(
        "id, tournament_id, round, match_number, player1_id, player2_id, winner_id, status, player1_score, player2_score, score_submitted_by, score_submitted_at, score_proof_path, created_at"
      )
      .in("tournament_id", tournamentIds)
      .order("round", { ascending: true })
      .order("match_number", { ascending: true });

    if (matchError) {
      setMessage(`Error loading bracket matches: ${matchError.message}`);
      setAllTournamentMatches([]);
    } else {
      setAllTournamentMatches((matchData || []) as Match[]);
    }

    const profileIds = Array.from(
      new Set(
        loadedReviews
          .flatMap((match) => [
            match.player1_id,
            match.player2_id,
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

    setLoading(false);
  }, [router]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadReviews();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadReviews]);

  const sortedReviews = useMemo(() => {
    return [...reviews].sort((a, b) => {
      const aDate = a.score_submitted_at
        ? new Date(a.score_submitted_at).getTime()
        : 0;
      const bDate = b.score_submitted_at
        ? new Date(b.score_submitted_at).getTime()
        : 0;

      return aDate - bDate;
    });
  }, [reviews]);

  const tournamentReviewCounts = useMemo(() => {
    return reviews.reduce((acc, review) => {
      acc[review.tournament_id] = (acc[review.tournament_id] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [reviews]);

  const uniqueTournamentCount = useMemo(() => {
    return Object.keys(tournamentReviewCounts).length;
  }, [tournamentReviewCounts]);

  function playerName(playerId: string | null) {
    if (!playerId) return "TBD";

    return profilesById[playerId]?.gamer_tag || "Unnamed Player";
  }

  function tournamentName(tournamentId: string) {
    return tournamentsById[tournamentId]?.name || "Unknown Tournament";
  }

  function proofUrl(path: string) {
    const { data } = supabase.storage.from("match-proofs").getPublicUrl(path);

    return data.publicUrl;
  }

  function updateWinner(matchId: string, winnerId: string) {
    setReviewEdits((currentReviewEdits) => ({
      ...currentReviewEdits,
      [matchId]: {
        ...(currentReviewEdits[matchId] || {
          winner_id: "",
        }),
        winner_id: winnerId,
      },
    }));
  }

  async function advanceWinner(match: Match, winnerId: string) {
    const nextRound = match.round + 1;
    const nextMatchNumber = Math.ceil(match.match_number / 2);
    const nextSlot = match.match_number % 2 === 1 ? "player1_id" : "player2_id";

    const nextMatch = allTournamentMatches.find(
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
        `Result approved, but winner could not advance: ${error.message}`
      );
    }
  }

  async function approveReview(match: Match) {
    const selectedWinnerId = reviewEdits[match.id]?.winner_id || "";

    if (!selectedWinnerId) {
      setMessage("Select the official winner before approving this result.");
      return;
    }

    if (
      selectedWinnerId !== match.player1_id &&
      selectedWinnerId !== match.player2_id
    ) {
      setMessage("Winner must be one of the players in the match.");
      return;
    }

    if (
      match.player1_score !== null &&
      match.player1_score !== undefined &&
      match.player2_score !== null &&
      match.player2_score !== undefined &&
      match.player1_score === match.player2_score
    ) {
      setMessage("Scores cannot be tied when approving a winner.");
      return;
    }

    const confirmed = window.confirm(
      `Approve this score and mark ${playerName(
        selectedWinnerId
      )} as the winner?`
    );

    if (!confirmed) return;

    setApprovingId(match.id);
    setMessage("");

    const { error } = await supabase
      .from("matches")
      .update({
        winner_id: selectedWinnerId,
        status: "completed",
      })
      .eq("id", match.id);

    if (error) {
      setMessage(`Error approving score: ${error.message}`);
      setApprovingId("");
      return;
    }

    await advanceWinner(match, selectedWinnerId);

    setMessage("Score approved successfully.");
    await loadReviews();
    setApprovingId("");
  }

  async function dismissReview(match: Match) {
    const confirmed = window.confirm(
      `Dismiss the submitted score for Round ${match.round}, Match ${match.match_number}?`
    );

    if (!confirmed) return;

    setDismissingId(match.id);
    setMessage("");

    const { error } = await supabase
      .from("matches")
      .update({
        player1_score: null,
        player2_score: null,
        score_submitted_by: null,
        score_submitted_at: null,
        score_proof_path: null,
        score_proof_uploaded_by: null,
        score_proof_uploaded_at: null,
        status: "pending",
      })
      .eq("id", match.id);

    if (error) {
      setMessage(`Error dismissing score: ${error.message}`);
      setDismissingId("");
      return;
    }

    setMessage("Score submission dismissed.");
    await loadReviews();
    setDismissingId("");
  }

  if (checkingAdmin || loading) {
    return (
      <main className="min-h-screen bg-black p-6 text-white">
        <div className="mx-auto max-w-6xl">
          <p className="rounded-xl border border-gray-800 bg-gray-950 p-6 text-gray-400">
            {checkingAdmin ? "Checking admin access..." : "Loading reviews..."}
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

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/admin/tournaments"
              className="text-sm text-gray-400 hover:text-white"
            >
              Bracket Manager →
            </Link>

            <Link
              href="/brackets"
              className="text-sm text-gray-400 hover:text-white"
            >
              Public Brackets →
            </Link>
          </div>
        </div>

        <section className="mb-8 rounded-2xl border border-gray-800 bg-gray-950 p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="mb-3 text-sm font-bold uppercase tracking-[0.25em] text-red-500">
                Admin Tools
              </p>

              <h1 className="mb-3 text-4xl font-black">Score Reviews</h1>

              <p className="max-w-2xl text-gray-400">
                Review player-submitted scores, inspect proof screenshots,
                approve official winners, or dismiss incorrect submissions.
              </p>
            </div>

            <button
              type="button"
              onClick={loadReviews}
              disabled={loading}
              className="rounded-lg bg-white px-5 py-3 font-bold text-black hover:bg-gray-200 disabled:opacity-50"
            >
              {loading ? "Refreshing..." : "Refresh Reviews"}
            </button>
          </div>
        </section>

        {message && (
          <p className="mb-6 rounded-lg border border-yellow-800 bg-yellow-950/30 p-4 text-sm text-yellow-200">
            {message}
          </p>
        )}

        <section className="mb-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-gray-800 bg-gray-950 p-5">
            <p className="text-sm text-gray-500">Pending Reviews</p>
            <p className="mt-2 text-4xl font-black">{reviews.length}</p>
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-950 p-5">
            <p className="text-sm text-gray-500">Tournaments Affected</p>
            <p className="mt-2 text-4xl font-black">{uniqueTournamentCount}</p>
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-950 p-5">
            <p className="text-sm text-gray-500">With Proof</p>
            <p className="mt-2 text-4xl font-black">
              {reviews.filter((review) => review.score_proof_path).length}
            </p>
          </div>
        </section>

        {sortedReviews.length === 0 ? (
          <section className="rounded-xl border border-gray-800 bg-gray-950 p-6">
            <h2 className="mb-2 text-2xl font-bold">No pending reviews</h2>

            <p className="mb-5 text-gray-400">
              Player score submissions will appear here after they submit scores
              from My Tournaments.
            </p>

            <Link
              href="/admin/tournaments"
              className="inline-block rounded-lg bg-white px-5 py-3 font-bold text-black hover:bg-gray-200"
            >
              Go to Bracket Manager
            </Link>
          </section>
        ) : (
          <section className="grid gap-6">
            {sortedReviews.map((match) => {
              const tournament = tournamentsById[match.tournament_id];
              const edit = reviewEdits[match.id] || {
                winner_id: suggestedWinnerId(match),
              };

              return (
                <article
                  key={match.id}
                  className="rounded-2xl border border-gray-800 bg-gray-950 p-6"
                >
                  <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="mb-2 text-sm font-bold uppercase tracking-[0.2em] text-red-500">
                        {tournamentName(match.tournament_id)}
                      </p>

                      <h2 className="text-3xl font-black">
                        Round {match.round}, Match {match.match_number}
                      </h2>

                      <p className="mt-2 text-gray-400">
                        {tournament?.game || "Game not set"} •{" "}
                        {tournament?.platform || "Platform not set"}
                      </p>

                      <p className="mt-2 text-sm text-gray-500">
                        Submitted: {formatDateTime(match.score_submitted_at)}
                      </p>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row">
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
                  </div>

                  <div className="mb-5 grid gap-4 md:grid-cols-3">
                    <div
                      className={`rounded-xl border p-4 ${
                        edit.winner_id === match.player1_id
                          ? "border-green-700 bg-green-950/30"
                          : "border-gray-800 bg-black"
                      }`}
                    >
                      <p className="text-xs text-gray-500">Player 1</p>

                      <p className="mt-1 text-xl font-bold">
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

                      <p className="mt-2 text-3xl font-black">
                        {match.player1_score ?? "-"}
                      </p>
                    </div>

                    <div
                      className={`rounded-xl border p-4 ${
                        edit.winner_id === match.player2_id
                          ? "border-green-700 bg-green-950/30"
                          : "border-gray-800 bg-black"
                      }`}
                    >
                      <p className="text-xs text-gray-500">Player 2</p>

                      <p className="mt-1 text-xl font-bold">
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

                      <p className="mt-2 text-3xl font-black">
                        {match.player2_score ?? "-"}
                      </p>
                    </div>

                    <div className="rounded-xl border border-gray-800 bg-black p-4">
                      <p className="text-xs text-gray-500">Submitted By</p>

                      <p className="mt-1 text-xl font-bold">
                        {match.score_submitted_by ? (
                          <Link
                            href={`/players/${match.score_submitted_by}`}
                            className="hover:text-red-400"
                          >
                            {playerName(match.score_submitted_by)}
                          </Link>
                        ) : (
                          "Unknown"
                        )}
                      </p>

                      <p className="mt-2 text-sm text-gray-400">
                        Score: {scoreText(match)}
                      </p>
                    </div>
                  </div>

                  {match.score_proof_path ? (
                    <div className="mb-5 overflow-hidden rounded-xl border border-gray-800 bg-black">
                      <Image
                        src={proofUrl(match.score_proof_path)}
                        alt="Submitted score proof screenshot"
                        width={1200}
                        height={700}
                        className="h-auto w-full object-cover"
                      />
                    </div>
                  ) : (
                    <p className="mb-5 rounded-xl border border-yellow-800 bg-yellow-950/20 p-4 text-sm text-yellow-200">
                      No proof screenshot was uploaded with this submission.
                    </p>
                  )}

                  <section className="rounded-xl border border-red-900 bg-red-950/10 p-4">
                    <h3 className="mb-4 text-xl font-bold text-red-200">
                      Review Decision
                    </h3>

                    <div className="mb-4">
                      <label className="mb-2 block text-sm text-gray-400">
                        Official Winner
                      </label>

                      <select
                        className="w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                        value={edit.winner_id}
                        onChange={(event) =>
                          updateWinner(match.id, event.target.value)
                        }
                      >
                        <option value="">Select official winner</option>

                        {match.player1_id && (
                          <option value={match.player1_id}>
                            {playerName(match.player1_id)}
                          </option>
                        )}

                        {match.player2_id && (
                          <option value={match.player2_id}>
                            {playerName(match.player2_id)}
                          </option>
                        )}
                      </select>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => approveReview(match)}
                        disabled={approvingId === match.id}
                        className="rounded-lg bg-white px-5 py-3 font-bold text-black hover:bg-gray-200 disabled:opacity-50"
                      >
                        {approvingId === match.id
                          ? "Approving..."
                          : "Approve Result"}
                      </button>

                      <button
                        type="button"
                        onClick={() => dismissReview(match)}
                        disabled={dismissingId === match.id}
                        className="rounded-lg border border-red-800 px-5 py-3 font-bold text-red-300 hover:bg-red-950/40 disabled:opacity-50"
                      >
                        {dismissingId === match.id
                          ? "Dismissing..."
                          : "Dismiss Submission"}
                      </button>
                    </div>
                  </section>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}