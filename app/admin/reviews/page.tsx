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

type WinnerInputs = Record<string, string>;

export default function AdminScoreReviewsPage() {
  const router = useRouter();

  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [matches, setMatches] = useState<Match[]>([]);
  const [tournaments, setTournaments] = useState<Record<string, Tournament>>({});
  const [profiles, setProfiles] = useState<Record<string, PlayerProfile>>({});
  const [winnerInputs, setWinnerInputs] = useState<WinnerInputs>({});

  const [loading, setLoading] = useState(true);
  const [savingMatchId, setSavingMatchId] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function verifyAndLoad() {
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

      await loadReviews();
    }

    verifyAndLoad();

    return () => {
      isMounted = false;
    };
  }, [router]);

  async function loadReviews() {
    setLoading(true);
    setMessage("");

    const { data: matchData, error: matchError } = await supabase
      .from("matches")
      .select("*")
      .not("score_submitted_by", "is", null)
      .neq("status", "completed")
      .order("score_submitted_at", { ascending: true });

    if (matchError) {
      setMessage(`Error loading score reviews: ${matchError.message}`);
      setMatches([]);
      setLoading(false);
      return;
    }

    const loadedMatches = (matchData || []) as Match[];

    setMatches(loadedMatches);

    const newWinnerInputs: WinnerInputs = {};

    for (const match of loadedMatches) {
      newWinnerInputs[match.id] = match.winner_id || "";
    }

    setWinnerInputs(newWinnerInputs);

    const tournamentIds = Array.from(
      new Set(loadedMatches.map((match) => match.tournament_id))
    );

    const playerIds = Array.from(
      new Set(
        loadedMatches
          .flatMap((match) => [
            match.player1_id,
            match.player2_id,
            match.score_submitted_by,
            match.winner_id,
          ])
          .filter((id): id is string => Boolean(id))
      )
    );

    if (tournamentIds.length > 0) {
      const { data: tournamentData, error: tournamentError } = await supabase
        .from("tournaments")
        .select("id, name, game, platform")
        .in("id", tournamentIds);

      if (tournamentError) {
        setMessage(`Error loading tournaments: ${tournamentError.message}`);
      } else {
        const tournamentMap = ((tournamentData || []) as Tournament[]).reduce(
          (acc, tournament) => {
            acc[tournament.id] = tournament;
            return acc;
          },
          {} as Record<string, Tournament>
        );

        setTournaments(tournamentMap);
      }
    } else {
      setTournaments({});
    }

    if (playerIds.length > 0) {
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, gamer_tag, platform, favorite_team")
        .in("id", playerIds);

      if (profileError) {
        setMessage(`Error loading profiles: ${profileError.message}`);
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
    } else {
      setProfiles({});
    }

    setLoading(false);
  }

  const reviewCount = useMemo(() => {
    return matches.length;
  }, [matches]);

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

  function getNextMatchNumber(matchNumber: number) {
    return Math.ceil(matchNumber / 2);
  }

  function shouldPlaceWinnerInPlayer1(matchNumber: number) {
    return matchNumber % 2 === 1;
  }

  function updateWinnerInput(matchId: string, winnerId: string) {
    setWinnerInputs((current) => ({
      ...current,
      [matchId]: winnerId,
    }));
  }

  async function verifyAdminAction() {
    const adminCheck = await checkIsAdmin();

    if (!adminCheck.user) {
      setMessage("You must be logged in as an admin.");
      router.push("/login");
      return false;
    }

    if (!adminCheck.isAdmin) {
      setMessage("You are not allowed to review scores.");
      router.push("/tournaments");
      return false;
    }

    return true;
  }

  async function approveResult(match: Match) {
    const winnerId = winnerInputs[match.id];

    if (!winnerId) {
      setMessage("Choose the official winner before approving.");
      return;
    }

    if (winnerId !== match.player1_id && winnerId !== match.player2_id) {
      setMessage("Winner must be one of the players in this match.");
      return;
    }

    if (!match.player1_id || !match.player2_id) {
      setMessage("Both players must be assigned before approving.");
      return;
    }

    setSavingMatchId(match.id);
    setMessage("");

    const allowed = await verifyAdminAction();

    if (!allowed) {
      setSavingMatchId("");
      return;
    }

    const { error: updateCurrentError } = await supabase
      .from("matches")
      .update({
        winner_id: winnerId,
        status: "completed",
      })
      .eq("id", match.id);

    if (updateCurrentError) {
      setMessage(`Error approving result: ${updateCurrentError.message}`);
      setSavingMatchId("");
      return;
    }

    const { data: nextMatchData, error: nextMatchError } = await supabase
      .from("matches")
      .select("*")
      .eq("tournament_id", match.tournament_id)
      .eq("round", match.round + 1)
      .eq("match_number", getNextMatchNumber(match.match_number))
      .maybeSingle();

    if (nextMatchError) {
      setMessage(
        `Result approved, but next match could not be checked: ${nextMatchError.message}`
      );
      await loadReviews();
      setSavingMatchId("");
      return;
    }

    const nextMatch = nextMatchData as Match | null;

    if (nextMatch) {
      const nextMatchUpdate = shouldPlaceWinnerInPlayer1(match.match_number)
        ? { player1_id: winnerId }
        : { player2_id: winnerId };

      const { error: advanceError } = await supabase
        .from("matches")
        .update(nextMatchUpdate)
        .eq("id", nextMatch.id);

      if (advanceError) {
        setMessage(
          `Result approved, but winner did not advance: ${advanceError.message}`
        );
        await loadReviews();
        setSavingMatchId("");
        return;
      }

      setMessage("Score approved. Winner advanced to the next round.");
    } else {
      setMessage(`Final score approved. Champion: ${playerName(winnerId)}.`);
    }

    await loadReviews();
    setSavingMatchId("");
  }

  async function dismissSubmission(match: Match) {
    const confirmed = window.confirm(
      "Dismiss this score submission? This clears the submitted score and lets the player submit again."
    );

    if (!confirmed) return;

    setSavingMatchId(match.id);
    setMessage("");

    const allowed = await verifyAdminAction();

    if (!allowed) {
      setSavingMatchId("");
      return;
    }

    const { error } = await supabase
      .from("matches")
      .update({
        player1_score: null,
        player2_score: null,
        score_submitted_by: null,
        score_submitted_at: null,
        status: "pending",
      })
      .eq("id", match.id);

    if (error) {
      setMessage(`Error dismissing submission: ${error.message}`);
      setSavingMatchId("");
      return;
    }

    setMessage("Score submission dismissed.");
    await loadReviews();
    setSavingMatchId("");
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
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Link href="/admin" className="text-sm text-gray-400 hover:text-white">
            ← Back to Admin
          </Link>

          <Link
            href="/admin/tournaments"
            className="text-sm text-gray-400 hover:text-white"
          >
            Bracket Manager →
          </Link>
        </div>

        <section className="mb-8 rounded-2xl border border-gray-800 bg-gray-950 p-6">
          <p className="mb-3 text-sm font-bold uppercase tracking-[0.25em] text-red-500">
            Admin Tools
          </p>

          <h1 className="mb-3 text-4xl font-black">Score Review Queue</h1>

          <p className="max-w-2xl text-gray-400">
            Review player-submitted scores, choose the official winner, and
            approve results faster.
          </p>

          <div className="mt-6 rounded-xl border border-gray-800 bg-black p-4">
            <p className="text-sm text-gray-500">Pending Reviews</p>
            <p className="text-4xl font-black">{reviewCount}</p>
          </div>
        </section>

        {message && (
          <p className="mb-6 rounded-lg border border-gray-800 bg-gray-950 p-4 text-sm text-gray-300">
            {message}
          </p>
        )}

        {loading ? (
          <p className="rounded-xl border border-gray-800 bg-gray-950 p-6 text-gray-400">
            Loading score reviews...
          </p>
        ) : matches.length === 0 ? (
          <section className="rounded-xl border border-gray-800 bg-gray-950 p-6">
            <h2 className="mb-2 text-2xl font-bold">No scores need review</h2>

            <p className="mb-5 text-gray-400">
              When players submit scores from My Tournaments, they will appear
              here.
            </p>

            <Link
              href="/admin/tournaments"
              className="inline-block rounded-lg bg-white px-5 py-3 font-bold text-black hover:bg-gray-200"
            >
              Go to Bracket Manager
            </Link>
          </section>
        ) : (
          <div className="grid gap-5">
            {matches.map((match) => {
              const tournament = tournaments[match.tournament_id];

              return (
                <section
                  key={match.id}
                  className="rounded-xl border border-gray-800 bg-gray-950 p-5"
                >
                  <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h2 className="text-2xl font-bold">
                        {tournament?.name || "Unknown Tournament"}
                      </h2>

                      <p className="mt-1 text-sm text-gray-400">
                        {tournament?.game || "Game not set"} •{" "}
                        {tournament?.platform || "Platform not set"}
                      </p>

                      <p className="mt-2 text-sm text-gray-500">
                        Round {match.round} — Match {match.match_number}
                      </p>
                    </div>

                    <span className="w-fit rounded-full border border-yellow-700 bg-yellow-950/40 px-3 py-1 text-xs font-bold text-yellow-300">
                      Pending Review
                    </span>
                  </div>

                  <div className="mb-5 grid gap-3 md:grid-cols-2">
                    <div className="rounded-lg border border-gray-800 bg-black p-4">
                      <p className="text-sm text-gray-500">
                        {playerName(match.player1_id)}
                      </p>
                      <p className="text-3xl font-black">
                        {match.player1_score ?? "-"}
                      </p>
                    </div>

                    <div className="rounded-lg border border-gray-800 bg-black p-4">
                      <p className="text-sm text-gray-500">
                        {playerName(match.player2_id)}
                      </p>
                      <p className="text-3xl font-black">
                        {match.player2_score ?? "-"}
                      </p>
                    </div>
                  </div>

                  <p className="mb-5 rounded-lg border border-gray-800 bg-black p-3 text-sm text-gray-300">
                    Submitted by{" "}
                    <span className="font-bold text-white">
                      {playerName(match.score_submitted_by)}
                    </span>{" "}
                    on {formatDisplayDate(match.score_submitted_at)}.
                  </p>

                  <div className="mb-5">
                    <label className="mb-1 block text-sm text-gray-400">
                      Official Winner
                    </label>

                    <select
                      className="w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                      value={winnerInputs[match.id] || ""}
                      onChange={(e) =>
                        updateWinnerInput(match.id, e.target.value)
                      }
                    >
                      <option value="">Choose winner</option>
                      <option value={match.player1_id || ""}>
                        {playerName(match.player1_id)}
                      </option>
                      <option value={match.player2_id || ""}>
                        {playerName(match.player2_id)}
                      </option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-3 md:flex-row">
                    <button
                      type="button"
                      onClick={() => approveResult(match)}
                      disabled={savingMatchId === match.id}
                      className="rounded-lg bg-white px-5 py-3 font-bold text-black hover:bg-gray-200 disabled:opacity-50"
                    >
                      {savingMatchId === match.id
                        ? "Approving..."
                        : "Approve Result"}
                    </button>

                    <button
                      type="button"
                      onClick={() => dismissSubmission(match)}
                      disabled={savingMatchId === match.id}
                      className="rounded-lg border border-red-800 px-5 py-3 font-bold text-red-300 hover:bg-red-950/40 disabled:opacity-50"
                    >
                      Dismiss Submission
                    </button>

                    <Link
                      href={`/brackets?tournament=${match.tournament_id}`}
                      className="rounded-lg border border-gray-700 px-5 py-3 text-center font-bold text-white hover:bg-gray-900"
                    >
                      View Bracket
                    </Link>
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}