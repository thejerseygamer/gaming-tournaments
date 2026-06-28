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

type ReviewFilter = "all" | "pending" | "approved" | "rejected";

type NewMatch = {
  tournament_id: string;
  round: number;
  match_number: number;
  player1_id: string | null;
  player2_id: string | null;
  winner_id: string | null;
};

export default function AdminReviewsPage() {
  const [reports, setReports] = useState<MatchReport[]>([]);
  const [matches, setMatches] = useState<Record<string, Match>>({});
  const [tournaments, setTournaments] = useState<Record<string, Tournament>>({});
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [searchText, setSearchText] = useState("");
  const [filter, setFilter] = useState<ReviewFilter>("pending");

  const [loading, setLoading] = useState(true);
  const [reviewingReportId, setReviewingReportId] = useState<string | null>(
    null
  );
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
        return "Platform not set";
      }

      return profiles[playerId]?.platform || "Platform not set";
    },
    [profiles]
  );

  const getTournamentName = useCallback(
    (tournamentId: string) => {
      return tournaments[tournamentId]?.name || "Unknown Tournament";
    },
    [tournaments]
  );

  const getTournamentGame = useCallback(
    (tournamentId: string) => {
      return tournaments[tournamentId]?.game || "Game not set";
    },
    [tournaments]
  );

  const getTournamentPlatform = useCallback(
    (tournamentId: string) => {
      return tournaments[tournamentId]?.platform || "Platform not set";
    },
    [tournaments]
  );

  useEffect(() => {
    let active = true;

    async function loadReviews() {
      await Promise.resolve();

      const { data: reportData, error: reportError } = await supabase
        .from("match_reports")
        .select(
          "id, match_id, tournament_id, submitted_by, player1_score, player2_score, reported_winner_id, notes, status, created_at"
        )
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

      if (loadedReports.length === 0) {
        setReports([]);
        setMatches({});
        setTournaments({});
        setProfiles({});
        setLoading(false);
        return;
      }

      const matchIds = Array.from(
        new Set(loadedReports.map((report) => report.match_id))
      );

      const tournamentIds = Array.from(
        new Set(loadedReports.map((report) => report.tournament_id))
      );

      const profileIds = Array.from(
        new Set(
          loadedReports
            .flatMap((report) => [
              report.submitted_by,
              report.reported_winner_id,
            ])
            .filter((id): id is string => Boolean(id))
        )
      );

      const matchMap: Record<string, Match> = {};
      const tournamentMap: Record<string, Tournament> = {};
      const profileMap: Record<string, Profile> = {};

      if (matchIds.length > 0) {
        const { data: matchData, error: matchError } = await supabase
          .from("matches")
          .select(
            "id, tournament_id, round, match_number, player1_id, player2_id, winner_id"
          )
          .in("id", matchIds);

        if (!active) {
          return;
        }

        if (matchError) {
          setMessage(matchError.message);
          setLoading(false);
          return;
        }

        ((matchData || []) as Match[]).forEach((match) => {
          matchMap[match.id] = match;

          if (match.player1_id) {
            profileIds.push(match.player1_id);
          }

          if (match.player2_id) {
            profileIds.push(match.player2_id);
          }

          if (match.winner_id) {
            profileIds.push(match.winner_id);
          }
        });
      }

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

      const uniqueProfileIds = Array.from(new Set(profileIds));

      if (uniqueProfileIds.length > 0) {
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("id, gamer_tag, platform, favorite_team")
          .in("id", uniqueProfileIds);

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

      setReports(loadedReports);
      setMatches(matchMap);
      setTournaments(tournamentMap);
      setProfiles(profileMap);
      setLoading(false);
    }

    loadReviews();

    return () => {
      active = false;
    };
  }, []);

  const totalPending = useMemo(() => {
    return reports.filter((report) => report.status === "pending").length;
  }, [reports]);

  const totalApproved = useMemo(() => {
    return reports.filter((report) => report.status === "approved").length;
  }, [reports]);

  const totalRejected = useMemo(() => {
    return reports.filter((report) => report.status === "rejected").length;
  }, [reports]);

  const totalTournamentsWithReports = useMemo(() => {
    return new Set(reports.map((report) => report.tournament_id)).size;
  }, [reports]);

  const filteredReports = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase();

    return reports.filter((report) => {
      if (filter !== "all" && report.status !== filter) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const match = matches[report.match_id];
      const tournamentName = getTournamentName(report.tournament_id).toLowerCase();
      const game = getTournamentGame(report.tournament_id).toLowerCase();
      const platform = getTournamentPlatform(report.tournament_id).toLowerCase();
      const submittedBy = getPlayerName(report.submitted_by).toLowerCase();
      const winnerName = getPlayerName(report.reported_winner_id).toLowerCase();
      const player1Name = getPlayerName(match?.player1_id || null).toLowerCase();
      const player2Name = getPlayerName(match?.player2_id || null).toLowerCase();

      return (
        tournamentName.includes(normalizedSearch) ||
        game.includes(normalizedSearch) ||
        platform.includes(normalizedSearch) ||
        submittedBy.includes(normalizedSearch) ||
        winnerName.includes(normalizedSearch) ||
        player1Name.includes(normalizedSearch) ||
        player2Name.includes(normalizedSearch)
      );
    });
  }, [
    reports,
    filter,
    searchText,
    matches,
    getTournamentName,
    getTournamentGame,
    getTournamentPlatform,
    getPlayerName,
  ]);

  function isFinalMatch(match: Match, tournamentMatches: Match[]) {
    const currentRound = match.round || 1;

    const matchesInCurrentRound = tournamentMatches.filter(
      (currentMatch) => (currentMatch.round || 1) === currentRound
    );

    return matchesInCurrentRound.length <= 1;
  }

  async function advanceWinnerToNextRound(match: Match, winnerId: string) {
    const { data: tournamentMatchData, error: tournamentMatchError } =
      await supabase
        .from("matches")
        .select(
          "id, tournament_id, round, match_number, player1_id, player2_id, winner_id"
        )
        .eq("tournament_id", match.tournament_id);

    if (tournamentMatchError) {
      throw new Error(tournamentMatchError.message);
    }

    const tournamentMatches = (tournamentMatchData || []) as Match[];

    if (isFinalMatch(match, tournamentMatches)) {
      return;
    }

    const currentRound = match.round || 1;
    const currentMatchNumber = match.match_number || 1;
    const nextRound = currentRound + 1;
    const nextMatchNumber = Math.ceil(currentMatchNumber / 2);

    const winnerSlot =
      currentMatchNumber % 2 === 1 ? "player1_id" : "player2_id";

    const existingNextMatch = tournamentMatches.find(
      (currentMatch) =>
        (currentMatch.round || 1) === nextRound &&
        (currentMatch.match_number || 1) === nextMatchNumber
    );

    if (existingNextMatch) {
      const { error } = await supabase
        .from("matches")
        .update({
          [winnerSlot]: winnerId,
          winner_id: null,
        })
        .eq("id", existingNextMatch.id);

      if (error) {
        throw new Error(error.message);
      }

      return;
    }

    const nextMatch: NewMatch = {
      tournament_id: match.tournament_id,
      round: nextRound,
      match_number: nextMatchNumber,
      player1_id: winnerSlot === "player1_id" ? winnerId : null,
      player2_id: winnerSlot === "player2_id" ? winnerId : null,
      winner_id: null,
    };

    const { error } = await supabase.from("matches").insert(nextMatch);

    if (error) {
      throw new Error(error.message);
    }
  }

  async function approveReport(report: MatchReport) {
    const match = matches[report.match_id];

    if (!match) {
      setMessage("Match not found for this report.");
      return;
    }

    if (
      report.reported_winner_id !== match.player1_id &&
      report.reported_winner_id !== match.player2_id
    ) {
      setMessage("Reported winner must be one of the players in the match.");
      return;
    }

    setReviewingReportId(report.id);
    setMessage("");

    const { error: updateMatchError } = await supabase
      .from("matches")
      .update({
        winner_id: report.reported_winner_id,
      })
      .eq("id", report.match_id);

    if (updateMatchError) {
      setMessage(updateMatchError.message);
      setReviewingReportId(null);
      return;
    }

    const { error: approveReportError } = await supabase
      .from("match_reports")
      .update({
        status: "approved",
      })
      .eq("id", report.id);

    if (approveReportError) {
      setMessage(approveReportError.message);
      setReviewingReportId(null);
      return;
    }

    const { error: rejectOtherReportsError } = await supabase
      .from("match_reports")
      .update({
        status: "rejected",
      })
      .eq("match_id", report.match_id)
      .neq("id", report.id)
      .eq("status", "pending");

    if (rejectOtherReportsError) {
      setMessage(rejectOtherReportsError.message);
      setReviewingReportId(null);
      return;
    }

    try {
      await advanceWinnerToNextRound(match, report.reported_winner_id);
    } catch (advanceError) {
      setMessage(
        advanceError instanceof Error
          ? advanceError.message
          : "Report approved, but advancing the winner failed."
      );
      setReviewingReportId(null);
      return;
    }

    setReports((currentReports) =>
      currentReports.map((currentReport) => {
        if (currentReport.id === report.id) {
          return {
            ...currentReport,
            status: "approved",
          };
        }

        if (
          currentReport.match_id === report.match_id &&
          currentReport.status === "pending"
        ) {
          return {
            ...currentReport,
            status: "rejected",
          };
        }

        return currentReport;
      })
    );

    setMatches((currentMatches) => ({
      ...currentMatches,
      [match.id]: {
        ...match,
        winner_id: report.reported_winner_id,
      },
    }));

    setMessage(
      `Approved report. Winner saved: ${getPlayerName(
        report.reported_winner_id
      )}`
    );
    setReviewingReportId(null);
  }

  async function rejectReport(report: MatchReport) {
    setReviewingReportId(report.id);
    setMessage("");

    const { error } = await supabase
      .from("match_reports")
      .update({
        status: "rejected",
      })
      .eq("id", report.id);

    if (error) {
      setMessage(error.message);
      setReviewingReportId(null);
      return;
    }

    setReports((currentReports) =>
      currentReports.map((currentReport) =>
        currentReport.id === report.id
          ? {
              ...currentReport,
              status: "rejected",
            }
          : currentReport
      )
    );

    setMessage("Report rejected.");
    setReviewingReportId(null);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-950 px-6 py-10 text-white">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-3xl font-bold">Admin Reviews</h1>
          <p className="mt-4 text-zinc-400">Loading submitted reports...</p>
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

            <h1 className="text-4xl font-black">Match Report Reviews</h1>

            <p className="mt-3 text-zinc-400">
              Approve or reject player-submitted match results.
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
            <p className="text-sm text-zinc-500">Total Reports</p>
            <p className="mt-2 text-4xl font-black">{reports.length}</p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <p className="text-sm text-zinc-500">Pending</p>
            <p className="mt-2 text-4xl font-black text-yellow-300">
              {totalPending}
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <p className="text-sm text-zinc-500">Approved</p>
            <p className="mt-2 text-4xl font-black text-green-300">
              {totalApproved}
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <p className="text-sm text-zinc-500">Rejected</p>
            <p className="mt-2 text-4xl font-black text-red-300">
              {totalRejected}
            </p>
          </div>
        </section>

        <section className="mb-8 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="grid gap-4 lg:grid-cols-[1fr_240px]">
            <div>
              <label className="mb-2 block text-sm font-semibold text-zinc-300">
                Search Reports
              </label>

              <input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Search tournament, player, game, or platform..."
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-red-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-zinc-300">
                Report Status
              </label>

              <select
                value={filter}
                onChange={(event) =>
                  setFilter(event.target.value as ReviewFilter)
                }
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-red-500"
              >
                <option value="all">All Reports</option>
                <option value="pending">Pending Only</option>
                <option value="approved">Approved Only</option>
                <option value="rejected">Rejected Only</option>
              </select>
            </div>
          </div>

          <p className="mt-4 text-sm text-zinc-500">
            Tournaments with reports: {totalTournamentsWithReports}
          </p>
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold">Submitted Reports</h2>

              <p className="mt-2 text-sm text-zinc-400">
                Showing {filteredReports.length} of {reports.length} reports.
              </p>
            </div>

            <Link
              href="/brackets"
              className="rounded-lg border border-zinc-700 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-zinc-800"
            >
              View Public Brackets
            </Link>
          </div>

          {reports.length === 0 && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-8 text-center">
              <h3 className="text-xl font-bold">No reports submitted yet</h3>

              <p className="mt-2 text-zinc-400">
                Player score reports will appear here after players submit
                match results from a tournament details page.
              </p>
            </div>
          )}

          {reports.length > 0 && filteredReports.length === 0 && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-8 text-center">
              <h3 className="text-xl font-bold">No reports match your filters</h3>

              <p className="mt-2 text-zinc-400">
                Try changing the search text or status filter.
              </p>
            </div>
          )}

          {filteredReports.length > 0 && (
            <div className="grid gap-5 lg:grid-cols-2">
              {filteredReports.map((report) => {
                const match = matches[report.match_id];

                const player1Id = match?.player1_id || null;
                const player2Id = match?.player2_id || null;

                return (
                  <article
                    key={report.id}
                    className="rounded-xl border border-zinc-800 bg-zinc-950 p-5"
                  >
                    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-bold uppercase tracking-widest text-red-400">
                          {getTournamentName(report.tournament_id)}
                        </p>

                        <h3 className="mt-2 text-xl font-black">
                          Round {match?.round || 1} • Match{" "}
                          {match?.match_number || "?"}
                        </h3>

                        <p className="mt-2 text-sm text-zinc-400">
                          {getTournamentGame(report.tournament_id)} •{" "}
                          {getTournamentPlatform(report.tournament_id)}
                        </p>
                      </div>

                      <span
                        className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${
                          report.status === "approved"
                            ? "bg-green-500/10 text-green-300"
                            : report.status === "rejected"
                            ? "bg-red-500/10 text-red-300"
                            : "bg-yellow-500/10 text-yellow-300"
                        }`}
                      >
                        {report.status}
                      </span>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div
                        className={`rounded-lg border p-4 ${
                          report.reported_winner_id === player1Id
                            ? "border-green-500/40 bg-green-500/10"
                            : "border-zinc-800 bg-zinc-900"
                        }`}
                      >
                        <p className="font-bold">{getPlayerName(player1Id)}</p>
                        <p className="mt-1 text-sm text-zinc-500">
                          {getPlayerPlatform(player1Id)}
                        </p>
                        <p className="mt-3 text-3xl font-black">
                          {report.player1_score}
                        </p>
                      </div>

                      <div
                        className={`rounded-lg border p-4 ${
                          report.reported_winner_id === player2Id
                            ? "border-green-500/40 bg-green-500/10"
                            : "border-zinc-800 bg-zinc-900"
                        }`}
                      >
                        <p className="font-bold">{getPlayerName(player2Id)}</p>
                        <p className="mt-1 text-sm text-zinc-500">
                          {getPlayerPlatform(player2Id)}
                        </p>
                        <p className="mt-3 text-3xl font-black">
                          {report.player2_score}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
                        <p className="text-sm text-zinc-500">Reported Winner</p>
                        <p className="mt-1 font-bold text-green-300">
                          {getPlayerName(report.reported_winner_id)}
                        </p>
                      </div>

                      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
                        <p className="text-sm text-zinc-500">Submitted By</p>
                        <p className="mt-1 font-bold">
                          {getPlayerName(report.submitted_by)}
                        </p>
                      </div>
                    </div>

                    {report.notes && (
                      <div className="mt-5 rounded-lg border border-zinc-800 bg-zinc-900 p-4">
                        <p className="text-sm text-zinc-500">Notes</p>
                        <p className="mt-1 text-sm text-zinc-300">
                          {report.notes}
                        </p>
                      </div>
                    )}

                    {match?.winner_id && (
                      <div className="mt-5 rounded-lg border border-green-500/40 bg-green-500/10 p-4">
                        <p className="text-sm text-green-200">Current Saved Winner</p>
                        <p className="mt-1 font-bold text-green-300">
                          {getPlayerName(match.winner_id)}
                        </p>
                      </div>
                    )}

                    <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                      <button
                        onClick={() => approveReport(report)}
                        disabled={
                          reviewingReportId === report.id ||
                          report.status !== "pending"
                        }
                        className="rounded-lg bg-green-600 px-4 py-3 text-sm font-bold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {reviewingReportId === report.id
                          ? "Approving..."
                          : "Approve Report"}
                      </button>

                      <button
                        onClick={() => rejectReport(report)}
                        disabled={
                          reviewingReportId === report.id ||
                          report.status !== "pending"
                        }
                        className="rounded-lg bg-red-600 px-4 py-3 text-sm font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {reviewingReportId === report.id
                          ? "Rejecting..."
                          : "Reject Report"}
                      </button>

                      <Link
                        href="/admin/tournaments"
                        className="rounded-lg border border-zinc-700 px-4 py-3 text-center text-sm font-bold text-white hover:bg-zinc-800"
                      >
                        Manage Bracket
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