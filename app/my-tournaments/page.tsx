"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
  registration_open: boolean;
  prize_pool: number | null;
  entry_fee: number | null;
  max_players: number | null;
  start_time: string | null;
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

type ScoreInput = {
  player1Score: string;
  player2Score: string;
};

export default function MyTournamentsPage() {
  const router = useRouter();

  const [userId, setUserId] = useState("");
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [matchesByTournament, setMatchesByTournament] = useState<
    Record<string, Match[]>
  >({});
  const [matchCounts, setMatchCounts] = useState<Record<string, number>>({});
  const [profiles, setProfiles] = useState<Record<string, PlayerProfile>>({});
  const [scoreInputs, setScoreInputs] = useState<Record<string, ScoreInput>>(
    {}
  );

  const [loading, setLoading] = useState(true);
  const [leavingId, setLeavingId] = useState("");
  const [submittingMatchId, setSubmittingMatchId] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadMyTournaments() {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (!isMounted) return;

      if (userError || !user) {
        router.push("/login");
        return;
      }

      setUserId(user.id);

      const { data: joinedRows, error: joinedError } = await supabase
        .from("tournament_players")
        .select("tournament_id, player_id")
        .eq("player_id", user.id);

      if (!isMounted) return;

      if (joinedError) {
        setMessage(`Error loading joined tournaments: ${joinedError.message}`);
        setTournaments([]);
        setLoading(false);
        return;
      }

      const joined = (joinedRows || []) as TournamentPlayer[];
      const tournamentIds = joined.map((row) => row.tournament_id);

      if (tournamentIds.length === 0) {
        setTournaments([]);
        setMatchesByTournament({});
        setMatchCounts({});
        setProfiles({});
        setScoreInputs({});
        setLoading(false);
        return;
      }

      const { data: tournamentData, error: tournamentError } = await supabase
        .from("tournaments")
        .select("*")
        .in("id", tournamentIds)
        .order("created_at", { ascending: false });

      if (!isMounted) return;

      if (tournamentError) {
        setMessage(`Error loading tournaments: ${tournamentError.message}`);
        setTournaments([]);
        setLoading(false);
        return;
      }

      const { data: matchData, error: matchError } = await supabase
        .from("matches")
        .select("*")
        .in("tournament_id", tournamentIds)
        .order("round", { ascending: true })
        .order("match_number", { ascending: true });

      if (!isMounted) return;

      if (matchError) {
        setMessage(`Error loading matches: ${matchError.message}`);
        setTournaments((tournamentData || []) as Tournament[]);
        setMatchesByTournament({});
        setMatchCounts({});
        setLoading(false);
        return;
      }

      const allMatches = (matchData || []) as Match[];

      const newMatchCounts: Record<string, number> = {};

      for (const match of allMatches) {
        newMatchCounts[match.tournament_id] =
          (newMatchCounts[match.tournament_id] || 0) + 1;
      }

      const userMatches = allMatches.filter(
        (match) => match.player1_id === user.id || match.player2_id === user.id
      );

      const groupedMatches: Record<string, Match[]> = {};

      for (const match of userMatches) {
        if (!groupedMatches[match.tournament_id]) {
          groupedMatches[match.tournament_id] = [];
        }

        groupedMatches[match.tournament_id].push(match);
      }

      const playerIds = Array.from(
        new Set(
          allMatches
            .flatMap((match) => [
              match.player1_id,
              match.player2_id,
              match.score_submitted_by,
            ])
            .filter((id): id is string => Boolean(id))
        )
      );

      let profileMap: Record<string, PlayerProfile> = {};

      if (playerIds.length > 0) {
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("id, gamer_tag, platform, favorite_team")
          .in("id", playerIds);

        if (!isMounted) return;

        if (profileError) {
          setMessage(`Error loading player profiles: ${profileError.message}`);
        } else {
          profileMap = ((profileData || []) as PlayerProfile[]).reduce(
            (acc, profile) => {
              acc[profile.id] = profile;
              return acc;
            },
            {} as Record<string, PlayerProfile>
          );
        }
      }

      setTournaments((tournamentData || []) as Tournament[]);
      setMatchesByTournament(groupedMatches);
      setMatchCounts(newMatchCounts);
      setProfiles(profileMap);
      setScoreInputs(buildScoreInputs(userMatches));
      setLoading(false);
    }

    loadMyTournaments();

    return () => {
      isMounted = false;
    };
  }, [router]);

  const tournamentCount = useMemo(() => {
    return tournaments.length;
  }, [tournaments]);

  const lockedCount = useMemo(() => {
    return tournaments.filter((tournament) => {
      return (matchCounts[tournament.id] || 0) > 0;
    }).length;
  }, [tournaments, matchCounts]);

  const closedCount = useMemo(() => {
    return tournaments.filter((tournament) => {
      const isLocked = (matchCounts[tournament.id] || 0) > 0;
      const isClosed = tournament.registration_open === false;

      return isClosed && !isLocked;
    }).length;
  }, [tournaments, matchCounts]);

  function buildScoreInputs(matchList: Match[]) {
    const inputs: Record<string, ScoreInput> = {};

    for (const match of matchList) {
      inputs[match.id] = {
        player1Score:
          match.player1_score === null || match.player1_score === undefined
            ? ""
            : String(match.player1_score),
        player2Score:
          match.player2_score === null || match.player2_score === undefined
            ? ""
            : String(match.player2_score),
      };
    }

    return inputs;
  }

  function formatDisplayDate(value: string | null) {
    if (!value) return "Not set";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "Not set";

    return date.toLocaleString();
  }

  function playerName(playerId: string | null) {
    if (!playerId) return "TBD";

    return profiles[playerId]?.gamer_tag || "Unnamed Player";
  }

  function isRegistrationLocked(tournament: Tournament) {
    return (matchCounts[tournament.id] || 0) > 0;
  }

  function isRegistrationClosed(tournament: Tournament) {
    return tournament.registration_open === false;
  }

  function getRegistrationLabel(tournament: Tournament) {
    if (isRegistrationLocked(tournament)) return "Registration Locked";
    if (isRegistrationClosed(tournament)) return "Registration Closed";

    return "Registration Open";
  }

  function getRegistrationClass(tournament: Tournament) {
    if (isRegistrationLocked(tournament)) {
      return "border-yellow-700 bg-yellow-950/40 text-yellow-300";
    }

    if (isRegistrationClosed(tournament)) {
      return "border-red-700 bg-red-950/40 text-red-300";
    }

    return "border-green-700 bg-green-950/40 text-green-300";
  }

  function getMainMatch(tournamentId: string) {
    const matches = matchesByTournament[tournamentId] || [];

    if (matches.length === 0) return null;

    const pendingMatch = matches.find((match) => match.status !== "completed");

    return pendingMatch || matches[matches.length - 1];
  }

  function getOpponent(match: Match) {
    if (match.player1_id === userId) return match.player2_id;
    if (match.player2_id === userId) return match.player1_id;

    return null;
  }

  function getResultText(match: Match) {
    if (match.status !== "completed" || !match.winner_id) {
      return "Pending admin review";
    }

    return match.winner_id === userId ? "You won" : "You lost";
  }

  function getScoreText(match: Match) {
    if (
      match.player1_score === null ||
      match.player1_score === undefined ||
      match.player2_score === null ||
      match.player2_score === undefined
    ) {
      return "No score reported";
    }

    return `${match.player1_score} - ${match.player2_score}`;
  }

  function getScoreSubmittedText(match: Match) {
    if (!match.score_submitted_by || !match.score_submitted_at) {
      return "No score has been submitted yet.";
    }

    return `Submitted by ${playerName(
      match.score_submitted_by
    )} on ${formatDisplayDate(match.score_submitted_at)}.`;
  }

  function updateScoreInput(
    matchId: string,
    field: keyof ScoreInput,
    value: string
  ) {
    setScoreInputs((current) => ({
      ...current,
      [matchId]: {
        player1Score: current[matchId]?.player1Score || "",
        player2Score: current[matchId]?.player2Score || "",
        [field]: value,
      },
    }));
  }

  async function reloadTournaments(currentUserId: string) {
    const { data: joinedRows, error: joinedError } = await supabase
      .from("tournament_players")
      .select("tournament_id, player_id")
      .eq("player_id", currentUserId);

    if (joinedError) {
      setMessage(`Error refreshing tournaments: ${joinedError.message}`);
      return;
    }

    const joined = (joinedRows || []) as TournamentPlayer[];
    const tournamentIds = joined.map((row) => row.tournament_id);

    if (tournamentIds.length === 0) {
      setTournaments([]);
      setMatchesByTournament({});
      setMatchCounts({});
      setScoreInputs({});
      return;
    }

    const { data: tournamentData, error: tournamentError } = await supabase
      .from("tournaments")
      .select("*")
      .in("id", tournamentIds)
      .order("created_at", { ascending: false });

    if (tournamentError) {
      setMessage(`Error refreshing tournaments: ${tournamentError.message}`);
      return;
    }

    const { data: matchData, error: matchError } = await supabase
      .from("matches")
      .select("*")
      .in("tournament_id", tournamentIds)
      .order("round", { ascending: true })
      .order("match_number", { ascending: true });

    if (matchError) {
      setMessage(`Error refreshing matches: ${matchError.message}`);
      return;
    }

    const allMatches = (matchData || []) as Match[];

    const newMatchCounts: Record<string, number> = {};

    for (const match of allMatches) {
      newMatchCounts[match.tournament_id] =
        (newMatchCounts[match.tournament_id] || 0) + 1;
    }

    const userMatches = allMatches.filter(
      (match) =>
        match.player1_id === currentUserId || match.player2_id === currentUserId
    );

    const groupedMatches: Record<string, Match[]> = {};

    for (const match of userMatches) {
      if (!groupedMatches[match.tournament_id]) {
        groupedMatches[match.tournament_id] = [];
      }

      groupedMatches[match.tournament_id].push(match);
    }

    const playerIds = Array.from(
      new Set(
        allMatches
          .flatMap((match) => [
            match.player1_id,
            match.player2_id,
            match.score_submitted_by,
          ])
          .filter((id): id is string => Boolean(id))
      )
    );

    if (playerIds.length > 0) {
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, gamer_tag, platform, favorite_team")
        .in("id", playerIds);

      if (profileError) {
        setMessage(`Error refreshing profiles: ${profileError.message}`);
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

    setTournaments((tournamentData || []) as Tournament[]);
    setMatchesByTournament(groupedMatches);
    setMatchCounts(newMatchCounts);
    setScoreInputs(buildScoreInputs(userMatches));
  }

  async function submitScore(match: Match) {
    if (!userId) {
      setMessage("You must be logged in to submit a score.");
      router.push("/login");
      return;
    }

    if (match.status === "completed") {
      setMessage("This match is already completed.");
      return;
    }

    if (!match.player1_id || !match.player2_id) {
      setMessage("Both players must be assigned before a score can be submitted.");
      return;
    }

    if (match.player1_id !== userId && match.player2_id !== userId) {
      setMessage("You can only submit scores for your own matches.");
      return;
    }

    const input = scoreInputs[match.id];

    if (!input) {
      setMessage("No score input found for this match.");
      return;
    }

    if (input.player1Score.trim() === "" || input.player2Score.trim() === "") {
      setMessage("Enter both scores before submitting.");
      return;
    }

    const player1Score = Number(input.player1Score);
    const player2Score = Number(input.player2Score);

    if (
      Number.isNaN(player1Score) ||
      Number.isNaN(player2Score) ||
      player1Score < 0 ||
      player2Score < 0
    ) {
      setMessage("Scores must be valid numbers.");
      return;
    }

    setSubmittingMatchId(match.id);
    setMessage("");

    const { error } = await supabase
      .from("matches")
      .update({
        player1_score: player1Score,
        player2_score: player2Score,
        score_submitted_by: userId,
        score_submitted_at: new Date().toISOString(),
        status: "pending",
      })
      .eq("id", match.id)
      .or(`player1_id.eq.${userId},player2_id.eq.${userId}`);

    if (error) {
      setMessage(`Error submitting score: ${error.message}`);
      setSubmittingMatchId("");
      return;
    }

    setMessage(
      "Score submitted. An admin still needs to choose the official winner."
    );

    await reloadTournaments(userId);
    setSubmittingMatchId("");
  }

  async function leaveTournament(tournament: Tournament) {
    if (isRegistrationLocked(tournament)) {
      setMessage(
        "You cannot leave after the bracket has been generated. Contact an admin if you need help."
      );
      return;
    }

    const confirmed = window.confirm(
      `Leave "${tournament.name}"? You can join again later if spots are still open.`
    );

    if (!confirmed) return;

    setLeavingId(tournament.id);
    setMessage("");

    if (!userId) {
      setMessage("You must be logged in to leave a tournament.");
      setLeavingId("");
      router.push("/login");
      return;
    }

    const { error } = await supabase
      .from("tournament_players")
      .delete()
      .eq("tournament_id", tournament.id)
      .eq("player_id", userId);

    if (error) {
      setMessage(`Error leaving tournament: ${error.message}`);
      setLeavingId("");
      return;
    }

    setMessage(`You left ${tournament.name}.`);
    await reloadTournaments(userId);
    setLeavingId("");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black p-6 text-white">
        <div className="mx-auto max-w-5xl">
          <p className="rounded-xl border border-gray-800 bg-gray-950 p-6 text-gray-400">
            Loading your tournaments...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black p-6 text-white">
      <div className="mx-auto max-w-5xl">
        <section className="mb-8 rounded-2xl border border-gray-800 bg-gray-950 p-6">
          <p className="mb-3 text-sm font-bold uppercase tracking-[0.25em] text-red-500">
            Player Dashboard
          </p>

          <h1 className="mb-3 text-4xl font-black">My Tournaments</h1>

          <p className="max-w-2xl text-gray-400">
            Track your tournaments, submit match scores, and follow your bracket
            results.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-gray-800 bg-black p-4">
              <p className="text-sm text-gray-500">Joined Tournaments</p>
              <p className="text-3xl font-black">{tournamentCount}</p>
            </div>

            <div className="rounded-xl border border-gray-800 bg-black p-4">
              <p className="text-sm text-gray-500">Closed Registration</p>
              <p className="text-3xl font-black">{closedCount}</p>
            </div>

            <div className="rounded-xl border border-gray-800 bg-black p-4">
              <p className="text-sm text-gray-500">Locked Brackets</p>
              <p className="text-3xl font-black">{lockedCount}</p>
            </div>
          </div>
        </section>

        {message && (
          <p className="mb-6 rounded-lg border border-gray-800 bg-gray-950 p-4 text-sm text-gray-300">
            {message}
          </p>
        )}

        {tournaments.length === 0 ? (
          <section className="rounded-xl border border-gray-800 bg-gray-950 p-6">
            <h2 className="mb-2 text-2xl font-bold">
              You have not joined any tournaments yet
            </h2>

            <p className="mb-5 text-gray-400">
              Browse active tournaments and join one to see it here.
            </p>

            <Link
              href="/tournaments"
              className="inline-block rounded-lg bg-white px-5 py-3 font-bold text-black hover:bg-gray-200"
            >
              Browse Tournaments
            </Link>
          </section>
        ) : (
          <div className="grid gap-5">
            {tournaments.map((tournament) => {
              const mainMatch = getMainMatch(tournament.id);
              const opponentId = mainMatch ? getOpponent(mainMatch) : null;
              const registrationLocked = isRegistrationLocked(tournament);
              const scoreInput = mainMatch
                ? scoreInputs[mainMatch.id] || {
                    player1Score: "",
                    player2Score: "",
                  }
                : {
                    player1Score: "",
                    player2Score: "",
                  };

              const canSubmitScore =
                Boolean(mainMatch) &&
                mainMatch?.status !== "completed" &&
                Boolean(mainMatch?.player1_id) &&
                Boolean(mainMatch?.player2_id);

              return (
                <div
                  key={tournament.id}
                  className="rounded-xl border border-gray-800 bg-gray-950 p-5"
                >
                  <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h2 className="text-2xl font-bold">{tournament.name}</h2>

                      <p className="mt-1 text-sm text-gray-400">
                        {tournament.game || "Game not set"} •{" "}
                        {tournament.platform || "Platform not set"}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span className="w-fit rounded-full border border-green-700 bg-green-950/40 px-3 py-1 text-xs font-bold text-green-300">
                        Joined
                      </span>

                      <span
                        className={`w-fit rounded-full border px-3 py-1 text-xs font-bold ${getRegistrationClass(
                          tournament
                        )}`}
                      >
                        {getRegistrationLabel(tournament)}
                      </span>
                    </div>
                  </div>

                  <div className="mb-5 grid gap-2 text-sm text-gray-300 md:grid-cols-2">
                    <p>
                      <span className="text-gray-500">Prize Pool:</span> $
                      {tournament.prize_pool || 0}
                    </p>

                    <p>
                      <span className="text-gray-500">Entry Fee:</span> $
                      {tournament.entry_fee || 0}
                    </p>

                    <p>
                      <span className="text-gray-500">Max Players:</span>{" "}
                      {tournament.max_players || 0}
                    </p>

                    <p>
                      <span className="text-gray-500">Start Time:</span>{" "}
                      {formatDisplayDate(tournament.start_time)}
                    </p>
                  </div>

                  <div className="mb-5 rounded-xl border border-gray-800 bg-black p-4">
                    <h3 className="mb-3 text-xl font-bold">My Match</h3>

                    {!mainMatch ? (
                      <p className="text-gray-400">
                        No bracket match yet. Wait for an admin to generate the
                        bracket.
                      </p>
                    ) : (
                      <div className="grid gap-4">
                        <div className="grid gap-2 text-sm text-gray-300">
                          <p>
                            <span className="text-gray-500">Round:</span>{" "}
                            {mainMatch.round}
                          </p>

                          <p>
                            <span className="text-gray-500">Match:</span>{" "}
                            {mainMatch.match_number}
                          </p>

                          <p>
                            <span className="text-gray-500">Opponent:</span>{" "}
                            {playerName(opponentId)}
                          </p>

                          <p>
                            <span className="text-gray-500">Current Score:</span>{" "}
                            {getScoreText(mainMatch)}
                          </p>

                          <p>
                            <span className="text-gray-500">Status:</span>{" "}
                            {getResultText(mainMatch)}
                          </p>

                          <p>
                            <span className="text-gray-500">
                              Score Submission:
                            </span>{" "}
                            {getScoreSubmittedText(mainMatch)}
                          </p>
                        </div>

                        {canSubmitScore ? (
                          <div className="rounded-xl border border-gray-800 bg-gray-950 p-4">
                            <h4 className="mb-3 font-bold">Submit Score</h4>

                            <div className="grid gap-3 md:grid-cols-2">
                              <div>
                                <label className="mb-1 block text-sm text-gray-400">
                                  {playerName(mainMatch.player1_id)} Score
                                </label>

                                <input
                                  type="number"
                                  min="0"
                                  className="w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                                  value={scoreInput.player1Score}
                                  onChange={(e) =>
                                    updateScoreInput(
                                      mainMatch.id,
                                      "player1Score",
                                      e.target.value
                                    )
                                  }
                                />
                              </div>

                              <div>
                                <label className="mb-1 block text-sm text-gray-400">
                                  {playerName(mainMatch.player2_id)} Score
                                </label>

                                <input
                                  type="number"
                                  min="0"
                                  className="w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                                  value={scoreInput.player2Score}
                                  onChange={(e) =>
                                    updateScoreInput(
                                      mainMatch.id,
                                      "player2Score",
                                      e.target.value
                                    )
                                  }
                                />
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => submitScore(mainMatch)}
                              disabled={submittingMatchId === mainMatch.id}
                              className="mt-4 rounded-lg bg-white px-5 py-3 font-bold text-black hover:bg-gray-200 disabled:opacity-50"
                            >
                              {submittingMatchId === mainMatch.id
                                ? "Submitting..."
                                : mainMatch.score_submitted_by
                                ? "Resubmit Score"
                                : "Submit Score"}
                            </button>

                            <p className="mt-3 text-xs text-gray-500">
                              Admin still chooses the official winner after
                              scores are submitted.
                            </p>
                          </div>
                        ) : mainMatch.status === "completed" ? (
                          <p className="rounded-lg border border-green-800 bg-green-950/30 p-3 text-sm text-green-300">
                            This match is completed.
                          </p>
                        ) : (
                          <p className="rounded-lg border border-gray-800 bg-gray-950 p-3 text-sm text-gray-400">
                            Waiting for both players to be assigned.
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-3 md:flex-row">
                    <Link
                      href={`/tournaments/${tournament.id}`}
                      className="rounded-lg bg-white px-5 py-3 text-center font-bold text-black hover:bg-gray-200"
                    >
                      View Tournament
                    </Link>

                    <Link
                      href={`/brackets?tournament=${tournament.id}`}
                      className="rounded-lg border border-gray-700 px-5 py-3 text-center font-bold text-white hover:bg-gray-900"
                    >
                      View Bracket
                    </Link>

                    <button
                      type="button"
                      onClick={() => leaveTournament(tournament)}
                      disabled={leavingId === tournament.id || registrationLocked}
                      className="rounded-lg border border-red-800 px-5 py-3 font-bold text-red-300 hover:bg-red-950/40 disabled:opacity-50"
                    >
                      {leavingId === tournament.id
                        ? "Leaving..."
                        : registrationLocked
                        ? "Locked"
                        : "Leave"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}