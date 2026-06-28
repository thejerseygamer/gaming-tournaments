"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { checkIsAdmin } from "../../lib/admin";
import { generateSingleEliminationBracket } from "../../lib/bracket-engine";

type Tournament = {
  id: string;
  name: string;
  game: string | null;
  platform: string | null;
  registration_open: boolean;
  max_players: number | null;
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
  player1_score: number | null;
  player2_score: number | null;
  score_submitted_by: string | null;
  score_submitted_at: string | null;
  status: string | null;
};

type NewMatch = {
  tournament_id: string;
  round: number;
  match_number: number;
  player1_id: string | null;
  player2_id: string | null;
  winner_id?: string | null;
  player1_score?: number | null;
  player2_score?: number | null;
  status?: string | null;
};

type ScoreInput = {
  player1Score: string;
  player2Score: string;
  winnerId: string;
};

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
      winnerId: match.winner_id || "",
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

async function fetchProfilesFor(
  playerRows: TournamentPlayer[],
  matchRows: Match[]
) {
  const profileIds = Array.from(
    new Set(
      [
        ...playerRows.map((row) => row.player_id),
        ...matchRows.flatMap((match) => [
          match.player1_id,
          match.player2_id,
          match.winner_id,
          match.score_submitted_by,
        ]),
      ].filter((id): id is string => Boolean(id))
    )
  );

  if (profileIds.length === 0) {
    return {
      profileMap: {} as Record<string, PlayerProfile>,
      errorMessage: "",
    };
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, gamer_tag, platform, favorite_team")
    .in("id", profileIds);

  if (error) {
    return {
      profileMap: {} as Record<string, PlayerProfile>,
      errorMessage: error.message,
    };
  }

  const profileMap = ((data || []) as PlayerProfile[]).reduce(
    (acc, profile) => {
      acc[profile.id] = profile;
      return acc;
    },
    {} as Record<string, PlayerProfile>
  );

  return {
    profileMap,
    errorMessage: "",
  };
}

export default function AdminTournamentsPage() {
  const router = useRouter();

  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState("");
  const [players, setPlayers] = useState<TournamentPlayer[]>([]);
  const [profiles, setProfiles] = useState<Record<string, PlayerProfile>>({});
  const [matches, setMatches] = useState<Match[]>([]);
  const [scoreInputs, setScoreInputs] = useState<Record<string, ScoreInput>>(
    {}
  );

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [savingMatchId, setSavingMatchId] = useState("");
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
        .select(
          "id, name, game, platform, registration_open, max_players, created_at"
        )
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

    async function loadTournamentDetails() {
      setMessage("");

      const { data: playerRows, error: playersError } = await supabase
        .from("tournament_players")
        .select("tournament_id, player_id")
        .eq("tournament_id", selectedTournamentId);

      if (!isMounted) return;

      if (playersError) {
        setMessage(`Error loading players: ${playersError.message}`);
        setPlayers([]);
        setProfiles({});
        return;
      }

      const loadedPlayers = (playerRows || []) as TournamentPlayer[];

      const { data: matchData, error: matchError } = await supabase
        .from("matches")
        .select("*")
        .eq("tournament_id", selectedTournamentId)
        .order("round", { ascending: true })
        .order("match_number", { ascending: true });

      if (!isMounted) return;

      if (matchError) {
        setMessage(`Error loading bracket: ${matchError.message}`);
        setPlayers(loadedPlayers);
        setMatches([]);
        setProfiles({});
        return;
      }

      const loadedMatches = (matchData || []) as Match[];
      const { profileMap, errorMessage } = await fetchProfilesFor(
        loadedPlayers,
        loadedMatches
      );

      if (!isMounted) return;

      if (errorMessage) {
        setMessage(`Error loading profiles: ${errorMessage}`);
      }

      setPlayers(loadedPlayers);
      setMatches(loadedMatches);
      setScoreInputs(buildScoreInputs(loadedMatches));
      setProfiles(profileMap);
    }

    loadTournamentDetails();

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

  function getScoreSubmittedText(match: Match) {
    if (!match.score_submitted_by || !match.score_submitted_at) {
      return "No player score submitted yet.";
    }

    return `Submitted by ${playerName(
      match.score_submitted_by
    )} on ${formatDisplayDate(match.score_submitted_at)}.`;
  }

  function getNextMatchNumber(matchNumber: number) {
    return Math.ceil(matchNumber / 2);
  }

  function shouldPlaceWinnerInPlayer1(matchNumber: number) {
    return matchNumber % 2 === 1;
  }

  function getNextMatch(match: Match) {
    return (
      matches.find(
        (nextMatch) =>
          nextMatch.round === match.round + 1 &&
          nextMatch.match_number === getNextMatchNumber(match.match_number)
      ) || null
    );
  }

  function getChampionMatch() {
    if (matches.length === 0) return null;

    const highestRound = Math.max(...matches.map((match) => match.round));

    return (
      matches.find(
        (match) => match.round === highestRound && match.match_number === 1
      ) || null
    );
  }

  function getChampionName() {
    const championMatch = getChampionMatch();

    if (!championMatch?.winner_id) return "No champion yet";

    return playerName(championMatch.winner_id);
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
        winnerId: current[matchId]?.winnerId || "",
        [field]: value,
      },
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
      setMessage("You are not allowed to manage brackets.");
      router.push("/tournaments");
      return false;
    }

    return true;
  }

  async function reloadSelectedTournament() {
    if (!selectedTournamentId) return;

    const { data: tournamentData, error: tournamentError } = await supabase
      .from("tournaments")
      .select(
        "id, name, game, platform, registration_open, max_players, created_at"
      )
      .order("created_at", { ascending: false });

    if (tournamentError) {
      setMessage(`Error refreshing tournaments: ${tournamentError.message}`);
      return;
    }

    const { data: playerRows, error: playersError } = await supabase
      .from("tournament_players")
      .select("tournament_id, player_id")
      .eq("tournament_id", selectedTournamentId);

    if (playersError) {
      setMessage(`Error refreshing players: ${playersError.message}`);
      return;
    }

    const loadedPlayers = (playerRows || []) as TournamentPlayer[];

    const { data: matchData, error: matchError } = await supabase
      .from("matches")
      .select("*")
      .eq("tournament_id", selectedTournamentId)
      .order("round", { ascending: true })
      .order("match_number", { ascending: true });

    if (matchError) {
      setMessage(`Error refreshing bracket: ${matchError.message}`);
      return;
    }

    const loadedMatches = (matchData || []) as Match[];
    const { profileMap, errorMessage } = await fetchProfilesFor(
      loadedPlayers,
      loadedMatches
    );

    if (errorMessage) {
      setMessage(`Error refreshing profiles: ${errorMessage}`);
    }

    setTournaments((tournamentData || []) as Tournament[]);
    setPlayers(loadedPlayers);
    setMatches(loadedMatches);
    setScoreInputs(buildScoreInputs(loadedMatches));
    setProfiles(profileMap);
  }

  async function generateBracket() {
    if (!selectedTournament) return;

    setGenerating(true);
    setMessage("");

    const allowed = await verifyAdminAction();

    if (!allowed) {
      setGenerating(false);
      return;
    }

    const { data: playerRows, error: playersError } = await supabase
      .from("tournament_players")
      .select("tournament_id, player_id")
      .eq("tournament_id", selectedTournament.id);

    if (playersError) {
      setMessage(`Error loading players: ${playersError.message}`);
      setGenerating(false);
      return;
    }

    const joinedPlayers = (playerRows || []) as TournamentPlayer[];
    const playerIds = joinedPlayers.map((row) => row.player_id);

    if (playerIds.length < 2) {
      setMessage("You need at least 2 players to generate a bracket.");
      setGenerating(false);
      return;
    }

    if (matches.length > 0) {
      const confirmed = window.confirm(
        "A bracket already exists for this tournament. Delete and regenerate it?"
      );

      if (!confirmed) {
        setGenerating(false);
        return;
      }

      const { error: deleteError } = await supabase
        .from("matches")
        .delete()
        .eq("tournament_id", selectedTournament.id);

      if (deleteError) {
        setMessage(`Error deleting old bracket: ${deleteError.message}`);
        setGenerating(false);
        return;
      }
    }

    const generatedMatches = generateSingleEliminationBracket(
      selectedTournament.id,
      playerIds
    ) as NewMatch[];

    if (generatedMatches.length === 0) {
      setMessage("No matches were generated.");
      setGenerating(false);
      return;
    }

    const matchesToInsert = generatedMatches.map((match) => ({
      tournament_id: match.tournament_id,
      round: match.round,
      match_number: match.match_number,
      player1_id: match.player1_id,
      player2_id: match.player2_id,
      winner_id: match.winner_id || null,
      player1_score: match.player1_score || null,
      player2_score: match.player2_score || null,
      score_submitted_by: null,
      score_submitted_at: null,
      status: match.status || "pending",
    }));

    const { error: insertError } = await supabase
      .from("matches")
      .insert(matchesToInsert);

    if (insertError) {
      setMessage(`Error creating bracket: ${insertError.message}`);
      setGenerating(false);
      return;
    }

    const { error: closeRegistrationError } = await supabase
      .from("tournaments")
      .update({ registration_open: false })
      .eq("id", selectedTournament.id);

    if (closeRegistrationError) {
      setMessage(
        `Bracket created, but registration was not closed: ${closeRegistrationError.message}`
      );
      await reloadSelectedTournament();
      setGenerating(false);
      return;
    }

    setMessage(
      "Bracket generated successfully. Registration has been closed for this tournament."
    );

    await reloadSelectedTournament();
    setGenerating(false);
  }

  async function deleteBracket() {
    if (!selectedTournament) return;

    const confirmed = window.confirm(
      `Delete the bracket for "${selectedTournament.name}"? Registration will stay closed unless you reopen it from the Admin dashboard.`
    );

    if (!confirmed) return;

    setGenerating(true);
    setMessage("");

    const allowed = await verifyAdminAction();

    if (!allowed) {
      setGenerating(false);
      return;
    }

    const { error } = await supabase
      .from("matches")
      .delete()
      .eq("tournament_id", selectedTournament.id);

    if (error) {
      setMessage(`Error deleting bracket: ${error.message}`);
      setGenerating(false);
      return;
    }

    setMessage(
      "Bracket deleted. Registration is still controlled from the Admin dashboard."
    );

    await reloadSelectedTournament();
    setGenerating(false);
  }

  async function saveMatchResult(match: Match) {
    const input = scoreInputs[match.id];

    if (!input) {
      setMessage("No score input found for this match.");
      return;
    }

    if (!match.player1_id || !match.player2_id) {
      setMessage("This match cannot be scored until both players are assigned.");
      return;
    }

    if (!input.winnerId) {
      setMessage("Choose a winner before saving the match.");
      return;
    }

    if (input.winnerId !== match.player1_id && input.winnerId !== match.player2_id) {
      setMessage("Winner must be one of the players in this match.");
      return;
    }

    if (input.player1Score.trim() === "" || input.player2Score.trim() === "") {
      setMessage("Enter both scores before saving the match.");
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

    const nextMatch = getNextMatch(match);

    if (nextMatch?.status === "completed") {
      setMessage(
        "You cannot change this result because the next match has already been completed."
      );
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
        player1_score: player1Score,
        player2_score: player2Score,
        winner_id: input.winnerId,
        status: "completed",
      })
      .eq("id", match.id);

    if (updateCurrentError) {
      setMessage(`Error saving match result: ${updateCurrentError.message}`);
      setSavingMatchId("");
      return;
    }

    if (nextMatch) {
      const nextMatchUpdate = shouldPlaceWinnerInPlayer1(match.match_number)
        ? { player1_id: input.winnerId }
        : { player2_id: input.winnerId };

      const { error: updateNextError } = await supabase
        .from("matches")
        .update(nextMatchUpdate)
        .eq("id", nextMatch.id);

      if (updateNextError) {
        setMessage(
          `Match saved, but winner did not advance: ${updateNextError.message}`
        );
        await reloadSelectedTournament();
        setSavingMatchId("");
        return;
      }

      setMessage("Match result saved. Winner advanced to the next round.");
    } else {
      setMessage(`Final result saved. Champion: ${playerName(input.winnerId)}.`);
    }

    await reloadSelectedTournament();
    setSavingMatchId("");
  }

  async function resetMatchResult(match: Match) {
    if (match.status !== "completed") {
      setMessage("This match is not completed yet.");
      return;
    }

    const nextMatch = getNextMatch(match);

    if (nextMatch?.status === "completed") {
      setMessage(
        "You cannot reset this match because the next match has already been completed."
      );
      return;
    }

    const confirmed = window.confirm(
      "Reset this match result? The winner will be removed from the next round if applicable."
    );

    if (!confirmed) return;

    setSavingMatchId(match.id);
    setMessage("");

    const allowed = await verifyAdminAction();

    if (!allowed) {
      setSavingMatchId("");
      return;
    }

    const { error: resetCurrentError } = await supabase
      .from("matches")
      .update({
        player1_score: null,
        player2_score: null,
        winner_id: null,
        score_submitted_by: null,
        score_submitted_at: null,
        status: "pending",
      })
      .eq("id", match.id);

    if (resetCurrentError) {
      setMessage(`Error resetting match: ${resetCurrentError.message}`);
      setSavingMatchId("");
      return;
    }

    if (nextMatch && match.winner_id) {
      const clearNextMatchUpdate = shouldPlaceWinnerInPlayer1(match.match_number)
        ? { player1_id: null }
        : { player2_id: null };

      const { error: clearNextError } = await supabase
        .from("matches")
        .update(clearNextMatchUpdate)
        .eq("id", nextMatch.id);

      if (clearNextError) {
        setMessage(
          `Match reset, but next round was not cleared: ${clearNextError.message}`
        );
        await reloadSelectedTournament();
        setSavingMatchId("");
        return;
      }
    }

    setMessage("Match result reset.");
    await reloadSelectedTournament();
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
          <Link
            href="/admin"
            className="text-sm text-gray-400 hover:text-white"
          >
            ← Back to Admin
          </Link>

          <Link
            href="/admin/players"
            className="text-sm text-gray-400 hover:text-white"
          >
            Manage Players →
          </Link>
        </div>

        <section className="mb-8 rounded-2xl border border-gray-800 bg-gray-950 p-6">
          <p className="mb-3 text-sm font-bold uppercase tracking-[0.25em] text-red-500">
            Admin Tools
          </p>

          <h1 className="mb-3 text-4xl font-black">Bracket Manager</h1>

          <p className="max-w-2xl text-gray-400">
            Review player-submitted scores, choose winners, and automatically
            advance players into the next round.
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
              Create a tournament before generating a bracket.
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

            <section className="mb-6 rounded-xl border border-gray-800 bg-gray-950 p-6">
              <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-2xl font-bold">
                    {selectedTournament?.name || "Tournament"}
                  </h2>

                  <p className="mt-1 text-sm text-gray-400">
                    {selectedTournament?.game || "Game not set"} •{" "}
                    {selectedTournament?.platform || "Platform not set"}
                  </p>

                  {bracketGenerated && (
                    <p className="mt-3 rounded-lg border border-green-800 bg-green-950/30 p-3 text-sm text-green-300">
                      Champion: {getChampionName()}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="w-fit rounded-full border border-gray-700 bg-black px-3 py-1 text-xs font-bold text-gray-300">
                    {players.length} players
                  </span>

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
                      selectedTournament?.registration_open
                        ? "border-green-700 bg-green-950/40 text-green-300"
                        : "border-red-700 bg-red-950/40 text-red-300"
                    }`}
                  >
                    {selectedTournament?.registration_open
                      ? "Registration Open"
                      : "Registration Closed"}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-3 md:flex-row">
                <button
                  type="button"
                  onClick={generateBracket}
                  disabled={generating}
                  className="rounded-lg bg-white px-5 py-3 font-bold text-black hover:bg-gray-200 disabled:opacity-50"
                >
                  {generating
                    ? "Working..."
                    : bracketGenerated
                    ? "Regenerate Bracket"
                    : "Generate Bracket"}
                </button>

                {bracketGenerated && (
                  <button
                    type="button"
                    onClick={deleteBracket}
                    disabled={generating}
                    className="rounded-lg border border-red-800 px-5 py-3 font-bold text-red-300 hover:bg-red-950/40 disabled:opacity-50"
                  >
                    Delete Bracket
                  </button>
                )}

                {selectedTournament && (
                  <Link
                    href={`/brackets?tournament=${selectedTournament.id}`}
                    className="rounded-lg border border-gray-700 px-5 py-3 text-center font-bold text-white hover:bg-gray-900"
                  >
                    View Public Bracket
                  </Link>
                )}
              </div>
            </section>

            <section className="mb-6 rounded-xl border border-gray-800 bg-gray-950 p-6">
              <h2 className="mb-4 text-2xl font-bold">Joined Players</h2>

              {players.length === 0 ? (
                <p className="text-gray-400">
                  No players have joined this tournament yet.
                </p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {players.map((row, index) => (
                    <div
                      key={row.player_id}
                      className="rounded-lg border border-gray-800 bg-black p-4"
                    >
                      <p className="text-lg font-bold">
                        #{index + 1} {playerName(row.player_id)}
                      </p>

                      <div className="mt-1 grid gap-1 text-sm text-gray-400">
                        <p>
                          Platform:{" "}
                          {profiles[row.player_id]?.platform || "Not set"}
                        </p>

                        <p>
                          Favorite Team:{" "}
                          {profiles[row.player_id]?.favorite_team || "Not set"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-xl border border-gray-800 bg-gray-950 p-6">
              <h2 className="mb-4 text-2xl font-bold">Score Matches</h2>

              {matches.length === 0 ? (
                <p className="text-gray-400">
                  No bracket has been generated yet.
                </p>
              ) : (
                <div className="grid gap-6">
                  {rounds.map((roundGroup) => (
                    <div key={roundGroup.round}>
                      <h3 className="mb-3 text-xl font-bold">
                        Round {roundGroup.round}
                      </h3>

                      <div className="grid gap-4">
                        {roundGroup.matches.map((match) => {
                          const input = scoreInputs[match.id] || {
                            player1Score: "",
                            player2Score: "",
                            winnerId: "",
                          };

                          const isBye =
                            Boolean(match.player1_id) &&
                            !match.player2_id &&
                            match.status === "completed";

                          const canScore =
                            Boolean(match.player1_id) &&
                            Boolean(match.player2_id);

                          const scoreSubmitted = Boolean(
                            match.score_submitted_by && match.score_submitted_at
                          );

                          return (
                            <div
                              key={match.id}
                              className="rounded-xl border border-gray-800 bg-black p-4"
                            >
                              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                  <h4 className="font-bold">
                                    Round {match.round} — Match{" "}
                                    {match.match_number}
                                  </h4>

                                  <p className="mt-1 text-sm text-gray-500">
                                    {playerName(match.player1_id)} vs{" "}
                                    {playerName(match.player2_id)}
                                  </p>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                  {scoreSubmitted && match.status !== "completed" && (
                                    <span className="w-fit rounded-full border border-yellow-700 bg-yellow-950/40 px-3 py-1 text-xs font-bold text-yellow-300">
                                      Pending Review
                                    </span>
                                  )}

                                  <span
                                    className={`w-fit rounded-full border px-3 py-1 text-xs font-bold ${
                                      match.status === "completed"
                                        ? "border-green-700 bg-green-950/40 text-green-300"
                                        : "border-gray-700 bg-gray-950 text-gray-300"
                                    }`}
                                  >
                                    {match.status || "pending"}
                                  </span>
                                </div>
                              </div>

                              <p className="mb-4 rounded-lg border border-gray-800 bg-gray-950 p-3 text-sm text-gray-300">
                                <span className="text-gray-500">
                                  Score Submission:
                                </span>{" "}
                                {getScoreSubmittedText(match)}
                              </p>

                              {isBye ? (
                                <p className="rounded-lg border border-green-800 bg-green-950/30 p-3 text-sm text-green-300">
                                  Bye: {playerName(match.winner_id)} advanced
                                  automatically.
                                </p>
                              ) : !canScore ? (
                                <p className="rounded-lg border border-gray-800 bg-gray-950 p-3 text-sm text-gray-400">
                                  Waiting for both players to be assigned.
                                </p>
                              ) : (
                                <div className="grid gap-4">
                                  <div className="grid gap-3 md:grid-cols-2">
                                    <div>
                                      <label className="mb-1 block text-sm text-gray-400">
                                        {playerName(match.player1_id)} Score
                                      </label>

                                      <input
                                        type="number"
                                        min="0"
                                        className="w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                                        value={input.player1Score}
                                        onChange={(e) =>
                                          updateScoreInput(
                                            match.id,
                                            "player1Score",
                                            e.target.value
                                          )
                                        }
                                      />
                                    </div>

                                    <div>
                                      <label className="mb-1 block text-sm text-gray-400">
                                        {playerName(match.player2_id)} Score
                                      </label>

                                      <input
                                        type="number"
                                        min="0"
                                        className="w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                                        value={input.player2Score}
                                        onChange={(e) =>
                                          updateScoreInput(
                                            match.id,
                                            "player2Score",
                                            e.target.value
                                          )
                                        }
                                      />
                                    </div>
                                  </div>

                                  <div>
                                    <label className="mb-1 block text-sm text-gray-400">
                                      Official Winner
                                    </label>

                                    <select
                                      className="w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                                      value={input.winnerId}
                                      onChange={(e) =>
                                        updateScoreInput(
                                          match.id,
                                          "winnerId",
                                          e.target.value
                                        )
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
                                      onClick={() => saveMatchResult(match)}
                                      disabled={savingMatchId === match.id}
                                      className="rounded-lg bg-white px-5 py-3 font-bold text-black hover:bg-gray-200 disabled:opacity-50"
                                    >
                                      {savingMatchId === match.id
                                        ? "Saving..."
                                        : "Save Official Result"}
                                    </button>

                                    {match.status === "completed" && (
                                      <button
                                        type="button"
                                        onClick={() => resetMatchResult(match)}
                                        disabled={savingMatchId === match.id}
                                        className="rounded-lg border border-red-800 px-5 py-3 font-bold text-red-300 hover:bg-red-950/40 disabled:opacity-50"
                                      >
                                        Reset Result
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )}

                              {match.winner_id && !isBye && (
                                <p className="mt-3 rounded-lg border border-green-800 bg-green-950/30 p-3 text-sm text-green-300">
                                  Official Winner: {playerName(match.winner_id)}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}