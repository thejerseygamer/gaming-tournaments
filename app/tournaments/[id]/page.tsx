"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../lib/supabase";

type Tournament = {
  id: string;
  name: string;
  game: string | null;
  platform: string | null;
  prize_pool: number | null;
  entry_fee: number | null;
  max_players: number | null;
  created_at: string | null;
};

type TournamentPlayer = {
  tournament_id: string;
  player_id: string;
};

type Profile = {
  id: string;
  gamer_tag: string | null;
  platform: string | null;
  favorite_team: string | null;
};

type Match = {
  id: string;
  tournament_id: string;
  round: number | null;
  match_number: number | null;
  player1_id: string | null;
  player2_id: string | null;
  winner_id: string | null;
};

type MatchReport = {
  id: string;
  match_id: string;
  tournament_id: string;
  submitted_by: string;
  player1_score: number;
  player2_score: number;
  reported_winner_id: string;
  notes: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string | null;
};

type ReportForm = {
  player1Score: string;
  player2Score: string;
  notes: string;
};

export default function TournamentDetailsPage() {
  const params = useParams<{ id: string }>();
  const tournamentId = typeof params.id === "string" ? params.id : "";

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [players, setPlayers] = useState<TournamentPlayer[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [matches, setMatches] = useState<Match[]>([]);
  const [reports, setReports] = useState<MatchReport[]>([]);
  const [reportForms, setReportForms] = useState<Record<string, ReportForm>>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<Profile | null>(
    null
  );

  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [submittingMatchId, setSubmittingMatchId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function loadTournamentData() {
      await Promise.resolve();

      if (!active) {
        return;
      }

      setLoading(true);
      setMessage("");

      if (!tournamentId) {
        setMessage("Tournament ID is missing.");
        setLoading(false);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active) {
        return;
      }

      setCurrentUserId(user?.id || null);

      if (user) {
        const { data: userProfileData, error: userProfileError } = await supabase
          .from("profiles")
          .select("id, gamer_tag, platform, favorite_team")
          .eq("id", user.id)
          .maybeSingle();

        if (!active) {
          return;
        }

        if (userProfileError) {
          setMessage(userProfileError.message);
          setLoading(false);
          return;
        }

        setCurrentUserProfile((userProfileData || null) as Profile | null);
      } else {
        setCurrentUserProfile(null);
      }

      const { data: tournamentData, error: tournamentError } = await supabase
        .from("tournaments")
        .select(
          "id, name, game, platform, prize_pool, entry_fee, max_players, created_at"
        )
        .eq("id", tournamentId)
        .maybeSingle();

      if (!active) {
        return;
      }

      if (tournamentError) {
        setMessage(tournamentError.message);
        setLoading(false);
        return;
      }

      if (!tournamentData) {
        setTournament(null);
        setMessage("Tournament not found.");
        setLoading(false);
        return;
      }

      const loadedTournament = tournamentData as Tournament;
      setTournament(loadedTournament);

      const { data: playerData, error: playerError } = await supabase
        .from("tournament_players")
        .select("tournament_id, player_id")
        .eq("tournament_id", tournamentId);

      if (!active) {
        return;
      }

      if (playerError) {
        setMessage(playerError.message);
        setLoading(false);
        return;
      }

      const loadedPlayers = (playerData || []) as TournamentPlayer[];
      setPlayers(loadedPlayers);

      const { data: matchData, error: matchError } = await supabase
        .from("matches")
        .select(
          "id, tournament_id, round, match_number, player1_id, player2_id, winner_id"
        )
        .eq("tournament_id", tournamentId)
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
      setMatches(loadedMatches);

      const { data: reportData, error: reportError } = await supabase
        .from("match_reports")
        .select(
          "id, match_id, tournament_id, submitted_by, player1_score, player2_score, reported_winner_id, notes, status, created_at"
        )
        .eq("tournament_id", tournamentId)
        .order("created_at", { ascending: false });

      if (!active) {
        return;
      }

      if (reportError) {
        setMessage(reportError.message);
        setLoading(false);
        return;
      }

      const loadedReports = (reportData || []) as MatchReport[];
      setReports(loadedReports);

      const profileIds = Array.from(
        new Set(
          [
            ...loadedPlayers.map((player) => player.player_id),
            ...loadedMatches.flatMap((match) => [
              match.player1_id,
              match.player2_id,
              match.winner_id,
            ]),
            ...loadedReports.map((report) => report.reported_winner_id),
            user?.id || null,
          ].filter((id): id is string => Boolean(id))
        )
      );

      if (profileIds.length > 0) {
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("id, gamer_tag, platform, favorite_team")
          .in("id", profileIds);

        if (!active) {
          return;
        }

        if (profileError) {
          setMessage(profileError.message);
          setLoading(false);
          return;
        }

        const profileMap: Record<string, Profile> = {};

        ((profileData || []) as Profile[]).forEach((profile) => {
          profileMap[profile.id] = profile;
        });

        setProfiles(profileMap);
      } else {
        setProfiles({});
      }

      const initialForms: Record<string, ReportForm> = {};

      loadedMatches.forEach((match) => {
        initialForms[match.id] = {
          player1Score: "",
          player2Score: "",
          notes: "",
        };
      });

      setReportForms(initialForms);
      setLoading(false);
    }

    loadTournamentData();

    return () => {
      active = false;
    };
  }, [tournamentId]);

  const isJoined = useMemo(() => {
    if (!currentUserId) {
      return false;
    }

    return players.some((player) => player.player_id === currentUserId);
  }, [players, currentUserId]);

  const profileIsComplete = useMemo(() => {
    return Boolean(
      currentUserProfile?.gamer_tag?.trim() &&
        currentUserProfile?.platform?.trim()
    );
  }, [currentUserProfile]);

  const spotsTaken = players.length;
  const maxPlayers = tournament?.max_players || null;
  const spotsRemaining =
    maxPlayers !== null ? Math.max(maxPlayers - spotsTaken, 0) : null;
  const tournamentIsFull = maxPlayers !== null && spotsTaken >= maxPlayers;
  const bracketGenerated = matches.length > 0;

  const myMatches = useMemo(() => {
    if (!currentUserId) {
      return [];
    }

    return matches.filter(
      (match) =>
        match.player1_id === currentUserId || match.player2_id === currentUserId
    );
  }, [matches, currentUserId]);

  const reportsByMatch = useMemo(() => {
    const groupedReports: Record<string, MatchReport[]> = {};

    reports.forEach((report) => {
      if (!groupedReports[report.match_id]) {
        groupedReports[report.match_id] = [];
      }

      groupedReports[report.match_id].push(report);
    });

    return groupedReports;
  }, [reports]);

  function getPlayerName(playerId: string | null) {
    if (!playerId) {
      return "Waiting for player";
    }

    const profile = profiles[playerId];

    if (profile?.gamer_tag) {
      return profile.gamer_tag;
    }

    return "Unknown Player";
  }

  function getPlayerPlatform(playerId: string | null) {
    if (!playerId) {
      return "Platform not set";
    }

    return profiles[playerId]?.platform || "Platform not set";
  }

  function getPlayerFavoriteTeam(playerId: string) {
    return profiles[playerId]?.favorite_team || "Favorite team not set";
  }

  function updateReportForm(
    matchId: string,
    field: keyof ReportForm,
    value: string
  ) {
    setReportForms((currentForms) => ({
      ...currentForms,
      [matchId]: {
        player1Score: currentForms[matchId]?.player1Score || "",
        player2Score: currentForms[matchId]?.player2Score || "",
        notes: currentForms[matchId]?.notes || "",
        [field]: value,
      },
    }));
  }

  function currentUserAlreadyReported(matchId: string) {
    if (!currentUserId) {
      return false;
    }

    return reports.some(
      (report) =>
        report.match_id === matchId &&
        report.submitted_by === currentUserId &&
        report.status !== "rejected"
    );
  }

  function canSubmitReport(match: Match) {
    if (!currentUserId) {
      return false;
    }

    if (match.winner_id) {
      return false;
    }

    if (currentUserAlreadyReported(match.id)) {
      return false;
    }

    return match.player1_id === currentUserId || match.player2_id === currentUserId;
  }

  async function joinTournament() {
    if (!tournament) {
      setMessage("Tournament not found.");
      return;
    }

    setJoining(true);
    setMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setMessage("You must be logged in to join this tournament.");
      setJoining(false);
      return;
    }

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id, gamer_tag, platform, favorite_team")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      setMessage(profileError.message);
      setJoining(false);
      return;
    }

    const profile = (profileData || null) as Profile | null;
    setCurrentUserProfile(profile);

    if (!profile?.gamer_tag?.trim() || !profile?.platform?.trim()) {
      setMessage("Complete your profile before joining a tournament.");
      setJoining(false);
      return;
    }

    if (tournamentIsFull) {
      setMessage("This tournament is full.");
      setJoining(false);
      return;
    }

    const { data: existingJoin, error: existingJoinError } = await supabase
      .from("tournament_players")
      .select("tournament_id, player_id")
      .eq("tournament_id", tournament.id)
      .eq("player_id", user.id)
      .maybeSingle();

    if (existingJoinError) {
      setMessage(existingJoinError.message);
      setJoining(false);
      return;
    }

    if (existingJoin) {
      setMessage("You have already joined this tournament.");
      setJoining(false);
      return;
    }

    const { error: joinError } = await supabase
      .from("tournament_players")
      .insert({
        tournament_id: tournament.id,
        player_id: user.id,
      });

    if (joinError) {
      setMessage(joinError.message);
      setJoining(false);
      return;
    }

    setCurrentUserId(user.id);
    setPlayers((currentPlayers) => [
      ...currentPlayers,
      {
        tournament_id: tournament.id,
        player_id: user.id,
      },
    ]);

    setProfiles((currentProfiles) => ({
      ...currentProfiles,
      [user.id]: profile,
    }));

    setMessage("You joined the tournament successfully.");
    setJoining(false);
  }

  async function submitMatchReport(match: Match) {
    if (!currentUserId) {
      setMessage("You must be logged in to submit a match result.");
      return;
    }

    if (!tournament) {
      setMessage("Tournament not found.");
      return;
    }

    if (!canSubmitReport(match)) {
      setMessage("You cannot submit a report for this match.");
      return;
    }

    const form = reportForms[match.id];

    const player1Score = Number(form?.player1Score);
    const player2Score = Number(form?.player2Score);

    if (!Number.isInteger(player1Score) || player1Score < 0) {
      setMessage("Enter a valid Player 1 score.");
      return;
    }

    if (!Number.isInteger(player2Score) || player2Score < 0) {
      setMessage("Enter a valid Player 2 score.");
      return;
    }

    if (player1Score === player2Score) {
      setMessage("Scores cannot be tied. Enter the final winning score.");
      return;
    }

    const reportedWinnerId =
      player1Score > player2Score ? match.player1_id : match.player2_id;

    if (!reportedWinnerId) {
      setMessage("Could not determine the reported winner.");
      return;
    }

    setSubmittingMatchId(match.id);
    setMessage("");

    const { data, error } = await supabase
      .from("match_reports")
      .insert({
        match_id: match.id,
        tournament_id: tournament.id,
        submitted_by: currentUserId,
        player1_score: player1Score,
        player2_score: player2Score,
        reported_winner_id: reportedWinnerId,
        notes: form?.notes?.trim() || null,
        status: "pending",
      })
      .select(
        "id, match_id, tournament_id, submitted_by, player1_score, player2_score, reported_winner_id, notes, status, created_at"
      )
      .single();

    if (error) {
      setMessage(error.message);
      setSubmittingMatchId(null);
      return;
    }

    const newReport = data as MatchReport;

    setReports((currentReports) => [newReport, ...currentReports]);

    setReportForms((currentForms) => ({
      ...currentForms,
      [match.id]: {
        player1Score: "",
        player2Score: "",
        notes: "",
      },
    }));

    setMessage("Match result submitted for admin review.");
    setSubmittingMatchId(null);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-950 px-6 py-10 text-white">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-3xl font-bold">Tournament Details</h1>
          <p className="mt-4 text-zinc-400">Loading tournament...</p>
        </div>
      </main>
    );
  }

  if (!tournament) {
    return (
      <main className="min-h-screen bg-zinc-950 px-6 py-10 text-white">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-6 text-red-300">
            {message || "Tournament not found."}
          </div>

          <Link
            href="/tournaments"
            className="mt-6 inline-block rounded-lg bg-red-600 px-5 py-3 font-semibold text-white hover:bg-red-700"
          >
            Back to Tournaments
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="mb-2 text-sm font-bold uppercase tracking-widest text-red-400">
              Tournament Details
            </p>

            <h1 className="text-4xl font-bold">{tournament.name}</h1>

            <p className="mt-3 text-zinc-400">
              Join the tournament, view player spots, check bracket status, and
              submit match scores.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/tournaments"
              className="rounded-lg border border-zinc-700 px-4 py-2 text-center font-semibold text-white hover:bg-zinc-800"
            >
              Browse Tournaments
            </Link>

            <Link
              href="/brackets"
              className="rounded-lg bg-red-600 px-4 py-2 text-center font-semibold text-white hover:bg-red-700"
            >
              View Brackets
            </Link>
          </div>
        </div>

        {message && (
          <div className="mb-6 rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-red-300">
            {message}
          </div>
        )}

        {currentUserId && !profileIsComplete && (
          <div className="mb-6 rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-4 text-yellow-100">
            <p className="font-semibold">Profile required</p>

            <p className="mt-1 text-sm">
              Add your gamer tag and platform before joining tournaments.
            </p>

            <Link
              href="/profile"
              className="mt-4 inline-block rounded-lg bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700"
            >
              Complete Profile
            </Link>
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-[1.4fr_0.8fr]">
          <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="text-2xl font-bold">Tournament Info</h2>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg bg-zinc-950 p-4">
                <p className="text-sm text-zinc-500">Game</p>
                <p className="mt-1 font-semibold">
                  {tournament.game || "Not set"}
                </p>
              </div>

              <div className="rounded-lg bg-zinc-950 p-4">
                <p className="text-sm text-zinc-500">Platform</p>
                <p className="mt-1 font-semibold">
                  {tournament.platform || "Not set"}
                </p>
              </div>

              <div className="rounded-lg bg-zinc-950 p-4">
                <p className="text-sm text-zinc-500">Prize Pool</p>
                <p className="mt-1 font-semibold">
                  {tournament.prize_pool !== null
                    ? `$${tournament.prize_pool}`
                    : "Not set"}
                </p>
              </div>

              <div className="rounded-lg bg-zinc-950 p-4">
                <p className="text-sm text-zinc-500">Entry Fee</p>
                <p className="mt-1 font-semibold">
                  {tournament.entry_fee !== null
                    ? `$${tournament.entry_fee}`
                    : "Free / Not set"}
                </p>
              </div>

              <div className="rounded-lg bg-zinc-950 p-4">
                <p className="text-sm text-zinc-500">Players</p>
                <p className="mt-1 font-semibold">
                  {spotsTaken}
                  {maxPlayers !== null ? ` / ${maxPlayers}` : ""}
                </p>
              </div>

              <div className="rounded-lg bg-zinc-950 p-4">
                <p className="text-sm text-zinc-500">Bracket</p>
                <p
                  className={`mt-1 font-semibold ${
                    bracketGenerated ? "text-green-300" : "text-yellow-300"
                  }`}
                >
                  {bracketGenerated ? "Generated" : "Not generated yet"}
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              {!currentUserId ? (
                <Link
                  href="/login"
                  className="rounded-lg bg-red-600 px-5 py-3 text-center font-semibold text-white hover:bg-red-700"
                >
                  Login to Join
                </Link>
              ) : !profileIsComplete ? (
                <Link
                  href="/profile"
                  className="rounded-lg bg-red-600 px-5 py-3 text-center font-semibold text-white hover:bg-red-700"
                >
                  Complete Profile to Join
                </Link>
              ) : (
                <button
                  onClick={joinTournament}
                  disabled={joining || isJoined || tournamentIsFull}
                  className="rounded-lg bg-red-600 px-5 py-3 font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {joining
                    ? "Joining..."
                    : isJoined
                    ? "Already Joined"
                    : tournamentIsFull
                    ? "Tournament Full"
                    : "Join Tournament"}
                </button>
              )}

              <Link
                href="/my-tournaments"
                className="rounded-lg border border-zinc-700 px-5 py-3 text-center font-semibold text-white hover:bg-zinc-800"
              >
                My Tournaments
              </Link>
            </div>
          </section>

          <aside className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="text-2xl font-bold">Status</h2>

            <div className="mt-5 space-y-4">
              <div className="rounded-lg bg-zinc-950 p-4">
                <p className="text-sm text-zinc-500">Spots Taken</p>
                <p className="mt-1 text-2xl font-bold">{spotsTaken}</p>
              </div>

              <div className="rounded-lg bg-zinc-950 p-4">
                <p className="text-sm text-zinc-500">Spots Remaining</p>
                <p className="mt-1 text-2xl font-bold">
                  {spotsRemaining !== null ? spotsRemaining : "Unlimited"}
                </p>
              </div>

              <div className="rounded-lg bg-zinc-950 p-4">
                <p className="text-sm text-zinc-500">Matches Created</p>
                <p className="mt-1 text-2xl font-bold">{matches.length}</p>
              </div>

              <div className="rounded-lg bg-zinc-950 p-4">
                <p className="text-sm text-zinc-500">Score Reports</p>
                <p className="mt-1 text-2xl font-bold">{reports.length}</p>
              </div>
            </div>
          </aside>
        </div>

        {isJoined && bracketGenerated && (
          <section className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="text-2xl font-bold">My Match Results</h2>

            <p className="mt-2 text-zinc-400">
              Submit your match score after playing. Admin will review and
              approve the result.
            </p>

            {myMatches.length === 0 && (
              <div className="mt-6 rounded-lg border border-zinc-800 bg-zinc-950 p-5 text-zinc-400">
                You do not have a match assigned yet.
              </div>
            )}

            {myMatches.length > 0 && (
              <div className="mt-6 grid gap-5 lg:grid-cols-2">
                {myMatches.map((match) => {
                  const matchReports = reportsByMatch[match.id] || [];
                  const myReport = matchReports.find(
                    (report) =>
                      report.submitted_by === currentUserId &&
                      report.status !== "rejected"
                  );

                  const reportForm = reportForms[match.id] || {
                    player1Score: "",
                    player2Score: "",
                    notes: "",
                  };

                  return (
                    <article
                      key={match.id}
                      className="rounded-xl border border-zinc-800 bg-zinc-950 p-5"
                    >
                      <div className="mb-4 flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-bold uppercase tracking-widest text-red-400">
                            Round {match.round || 1}
                          </p>

                          <h3 className="mt-2 text-xl font-bold">
                            Match {match.match_number || "?"}
                          </h3>
                        </div>

                        {match.winner_id ? (
                          <span className="rounded-full bg-green-500/10 px-3 py-1 text-xs font-bold text-green-300">
                            Complete
                          </span>
                        ) : myReport ? (
                          <span className="rounded-full bg-yellow-500/10 px-3 py-1 text-xs font-bold text-yellow-300">
                            Report Pending
                          </span>
                        ) : (
                          <span className="rounded-full bg-red-500/10 px-3 py-1 text-xs font-bold text-red-300">
                            Needs Report
                          </span>
                        )}
                      </div>

                      <div className="space-y-3">
                        <div
                          className={`rounded-lg border p-4 ${
                            match.winner_id === match.player1_id
                              ? "border-green-500/40 bg-green-500/10"
                              : "border-zinc-800 bg-zinc-900"
                          }`}
                        >
                          <p className="font-bold">
                            {getPlayerName(match.player1_id)}
                          </p>
                          <p className="mt-1 text-sm text-zinc-500">
                            {getPlayerPlatform(match.player1_id)}
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
                          <p className="font-bold">
                            {getPlayerName(match.player2_id)}
                          </p>
                          <p className="mt-1 text-sm text-zinc-500">
                            {getPlayerPlatform(match.player2_id)}
                          </p>
                        </div>
                      </div>

                      {match.winner_id && (
                        <div className="mt-5 rounded-lg border border-green-500/40 bg-green-500/10 p-4">
                          <p className="text-sm text-green-200">Winner</p>
                          <p className="mt-1 text-lg font-bold text-green-300">
                            {getPlayerName(match.winner_id)}
                          </p>
                        </div>
                      )}

                      {!match.winner_id && myReport && (
                        <div className="mt-5 rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-4">
                          <p className="font-semibold text-yellow-100">
                            Report submitted
                          </p>

                          <p className="mt-2 text-sm text-yellow-100/80">
                            Score: {myReport.player1_score} -{" "}
                            {myReport.player2_score}
                          </p>

                          <p className="mt-1 text-sm text-yellow-100/80">
                            Reported Winner:{" "}
                            {getPlayerName(myReport.reported_winner_id)}
                          </p>

                          <p className="mt-1 text-sm text-yellow-100/80">
                            Status: {myReport.status}
                          </p>
                        </div>
                      )}

                      {canSubmitReport(match) && (
                        <div className="mt-5 space-y-4">
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                              <label className="mb-2 block text-sm font-semibold text-zinc-300">
                                {getPlayerName(match.player1_id)} Score
                              </label>

                              <input
                                value={reportForm.player1Score}
                                onChange={(event) =>
                                  updateReportForm(
                                    match.id,
                                    "player1Score",
                                    event.target.value
                                  )
                                }
                                inputMode="numeric"
                                placeholder="0"
                                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none focus:border-red-500"
                              />
                            </div>

                            <div>
                              <label className="mb-2 block text-sm font-semibold text-zinc-300">
                                {getPlayerName(match.player2_id)} Score
                              </label>

                              <input
                                value={reportForm.player2Score}
                                onChange={(event) =>
                                  updateReportForm(
                                    match.id,
                                    "player2Score",
                                    event.target.value
                                  )
                                }
                                inputMode="numeric"
                                placeholder="0"
                                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none focus:border-red-500"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="mb-2 block text-sm font-semibold text-zinc-300">
                              Notes Optional
                            </label>

                            <textarea
                              value={reportForm.notes}
                              onChange={(event) =>
                                updateReportForm(
                                  match.id,
                                  "notes",
                                  event.target.value
                                )
                              }
                              placeholder="Example: Final score confirmed in stream chat."
                              className="min-h-24 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none focus:border-red-500"
                            />
                          </div>

                          <button
                            onClick={() => submitMatchReport(match)}
                            disabled={submittingMatchId === match.id}
                            className="w-full rounded-lg bg-red-600 px-5 py-3 font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {submittingMatchId === match.id
                              ? "Submitting..."
                              : "Submit Match Result"}
                          </button>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        <section className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold">Joined Players</h2>
              <p className="mt-1 text-zinc-400">
                Players currently signed up for this tournament.
              </p>
            </div>

            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                tournamentIsFull
                  ? "bg-red-500/10 text-red-300"
                  : "bg-green-500/10 text-green-300"
              }`}
            >
              {tournamentIsFull ? "Full" : "Open"}
            </span>
          </div>

          {players.length === 0 && (
            <div className="mt-6 rounded-lg border border-zinc-800 bg-zinc-950 p-5 text-zinc-400">
              No players have joined yet.
            </div>
          )}

          {players.length > 0 && (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {players.map((player, index) => (
                <div
                  key={player.player_id}
                  className="rounded-lg border border-zinc-800 bg-zinc-950 p-4"
                >
                  <p className="text-sm font-bold text-red-400">
                    Player {index + 1}
                  </p>

                  <p className="mt-2 text-lg font-semibold">
                    {getPlayerName(player.player_id)}
                  </p>

                  <p className="mt-1 text-sm text-zinc-500">
                    {getPlayerPlatform(player.player_id)}
                  </p>

                  <p className="mt-1 text-sm text-zinc-500">
                    {getPlayerFavoriteTeam(player.player_id)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}