"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

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

type Profile = {
  id: string;
  gamer_tag: string | null;
  platform: string | null;
  favorite_team: string | null;
};

export default function MyTournamentsPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [currentUserProfile, setCurrentUserProfile] =
    useState<Profile | null>(null);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadMyTournaments() {
      await Promise.resolve();

      if (!active) {
        return;
      }

      setLoading(true);
      setMessage("");
      setNeedsLogin(false);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (!active) {
        return;
      }

      if (userError || !user) {
        setMessage("You must be logged in to view your tournaments.");
        setNeedsLogin(true);
        setLoading(false);
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, gamer_tag, platform, favorite_team")
        .eq("id", user.id)
        .maybeSingle();

      if (!active) {
        return;
      }

      if (profileError) {
        setMessage(profileError.message);
        setLoading(false);
        return;
      }

      const userProfile = (profileData || null) as Profile | null;
      setCurrentUserProfile(userProfile);

      const { data: joinedRows, error: joinedError } = await supabase
        .from("tournament_players")
        .select("tournament_id")
        .eq("player_id", user.id);

      if (!active) {
        return;
      }

      if (joinedError) {
        setMessage(joinedError.message);
        setLoading(false);
        return;
      }

      const joinedTournamentRows = (joinedRows || []) as TournamentPlayer[];
      const tournamentIds = joinedTournamentRows.map((row) => row.tournament_id);

      if (tournamentIds.length === 0) {
        const profileMap: Record<string, Profile> = {};

        if (userProfile) {
          profileMap[userProfile.id] = userProfile;
        }

        setTournaments([]);
        setMatches([]);
        setProfiles(profileMap);
        setLoading(false);
        return;
      }

      const { data: tournamentData, error: tournamentError } = await supabase
        .from("tournaments")
        .select(
          "id, name, game, platform, prize_pool, entry_fee, max_players, created_at"
        )
        .in("id", tournamentIds)
        .order("created_at", { ascending: false });

      if (!active) {
        return;
      }

      if (tournamentError) {
        setMessage(tournamentError.message);
        setLoading(false);
        return;
      }

      const loadedTournaments = (tournamentData || []) as Tournament[];

      const { data: matchData, error: matchError } = await supabase
        .from("matches")
        .select(
          "id, tournament_id, round, match_number, player1_id, player2_id, winner_id"
        )
        .in("tournament_id", tournamentIds)
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

      const profileIds = Array.from(
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

      if (userProfile) {
        profileIds.push(userProfile.id);
      }

      const uniqueProfileIds = Array.from(new Set(profileIds));

      const profileMap: Record<string, Profile> = {};

      if (uniqueProfileIds.length > 0) {
        const { data: profileRows, error: profilesError } = await supabase
          .from("profiles")
          .select("id, gamer_tag, platform, favorite_team")
          .in("id", uniqueProfileIds);

        if (!active) {
          return;
        }

        if (profilesError) {
          setMessage(profilesError.message);
          setLoading(false);
          return;
        }

        ((profileRows || []) as Profile[]).forEach((profile) => {
          profileMap[profile.id] = profile;
        });
      }

      setTournaments(loadedTournaments);
      setMatches(loadedMatches);
      setProfiles(profileMap);
      setLoading(false);
    }

    loadMyTournaments();

    return () => {
      active = false;
    };
  }, []);

  const profileIsComplete = useMemo(() => {
    return Boolean(
      currentUserProfile?.gamer_tag?.trim() &&
        currentUserProfile?.platform?.trim()
    );
  }, [currentUserProfile]);

  const matchCounts = useMemo(() => {
    const counts: Record<string, number> = {};

    matches.forEach((match) => {
      counts[match.tournament_id] = (counts[match.tournament_id] || 0) + 1;
    });

    return counts;
  }, [matches]);

  const champions = useMemo(() => {
    const championMap: Record<string, string | null> = {};

    tournaments.forEach((tournament) => {
      const tournamentMatches = matches.filter(
        (match) => match.tournament_id === tournament.id
      );

      if (tournamentMatches.length === 0) {
        championMap[tournament.id] = null;
        return;
      }

      const highestRound = Math.max(
        ...tournamentMatches.map((match) => match.round || 1)
      );

      const finalRoundMatches = tournamentMatches.filter(
        (match) => (match.round || 1) === highestRound
      );

      if (finalRoundMatches.length !== 1) {
        championMap[tournament.id] = null;
        return;
      }

      championMap[tournament.id] = finalRoundMatches[0].winner_id || null;
    });

    return championMap;
  }, [matches, tournaments]);

  function getPlayerName(playerId: string | null) {
    if (!playerId) {
      return "Not decided yet";
    }

    const profile = profiles[playerId];

    if (profile?.gamer_tag) {
      return profile.gamer_tag;
    }

    return "Unknown Player";
  }

  function formatMoney(value: number | null) {
    if (value === null) {
      return "Not set";
    }

    if (value === 0) {
      return "Free";
    }

    return `$${value}`;
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-950 px-6 py-10 text-white">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-3xl font-bold">My Tournaments</h1>
          <p className="mt-4 text-zinc-400">Loading your tournaments...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="mb-2 text-sm font-bold uppercase tracking-widest text-red-400">
              Player Dashboard
            </p>

            <h1 className="text-4xl font-bold">My Tournaments</h1>

            <p className="mt-3 text-zinc-400">
              View tournaments you joined, check bracket progress, and track
              champion status.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/profile"
              className="rounded-lg border border-zinc-700 px-4 py-2 text-center font-semibold text-white hover:bg-zinc-800"
            >
              Profile
            </Link>

            <Link
              href="/tournaments"
              className="rounded-lg bg-red-600 px-4 py-2 text-center font-semibold text-white hover:bg-red-700"
            >
              Browse Tournaments
            </Link>
          </div>
        </div>

        {message && (
          <div className="mb-6 rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-red-300">
            <p>{message}</p>

            {needsLogin && (
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href="/login"
                  className="rounded-lg bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700"
                >
                  Login
                </Link>

                <Link
                  href="/signup"
                  className="rounded-lg border border-zinc-700 px-4 py-2 font-semibold text-white hover:bg-zinc-800"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        )}

        {!needsLogin && !profileIsComplete && (
          <div className="mb-6 rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-4 text-yellow-100">
            <p className="font-semibold">Complete your profile</p>

            <p className="mt-1 text-sm">
              Add your gamer tag and platform so tournaments and brackets show
              your real player name.
            </p>

            <Link
              href="/profile"
              className="mt-4 inline-block rounded-lg bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700"
            >
              Complete Profile
            </Link>
          </div>
        )}

        {!message && tournaments.length === 0 && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center">
            <h2 className="text-xl font-semibold">No tournaments joined yet</h2>

            <p className="mt-2 text-zinc-400">
              Join a tournament first, then it will appear here.
            </p>

            <Link
              href="/tournaments"
              className="mt-6 inline-block rounded-lg bg-red-600 px-5 py-3 font-semibold text-white hover:bg-red-700"
            >
              Find Tournaments
            </Link>
          </div>
        )}

        {!message && tournaments.length > 0 && (
          <div className="grid gap-6">
            {tournaments.map((tournament) => {
              const totalMatches = matchCounts[tournament.id] || 0;
              const championId = champions[tournament.id];
              const bracketGenerated = totalMatches > 0;

              return (
                <article
                  key={tournament.id}
                  className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-lg"
                >
                  <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex-1">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h2 className="text-2xl font-bold">
                            {tournament.name}
                          </h2>

                          <p className="mt-2 text-zinc-400">
                            {tournament.game || "Game not set"} •{" "}
                            {tournament.platform || "Platform not set"}
                          </p>
                        </div>

                        <span
                          className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${
                            bracketGenerated
                              ? "bg-green-500/10 text-green-300"
                              : "bg-yellow-500/10 text-yellow-300"
                          }`}
                        >
                          {bracketGenerated
                            ? "Bracket Generated"
                            : "Bracket Not Generated"}
                        </span>
                      </div>

                      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-lg bg-zinc-950 p-4">
                          <p className="text-sm text-zinc-500">Prize Pool</p>
                          <p className="mt-1 font-semibold">
                            {formatMoney(tournament.prize_pool)}
                          </p>
                        </div>

                        <div className="rounded-lg bg-zinc-950 p-4">
                          <p className="text-sm text-zinc-500">Entry Fee</p>
                          <p className="mt-1 font-semibold">
                            {formatMoney(tournament.entry_fee)}
                          </p>
                        </div>

                        <div className="rounded-lg bg-zinc-950 p-4">
                          <p className="text-sm text-zinc-500">Max Players</p>
                          <p className="mt-1 font-semibold">
                            {tournament.max_players || "Not set"}
                          </p>
                        </div>

                        <div className="rounded-lg bg-zinc-950 p-4">
                          <p className="text-sm text-zinc-500">Matches</p>
                          <p className="mt-1 font-semibold">{totalMatches}</p>
                        </div>
                      </div>

                      <div
                        className={`mt-5 rounded-lg border p-4 ${
                          championId
                            ? "border-green-500/40 bg-green-500/10"
                            : "border-zinc-800 bg-zinc-950"
                        }`}
                      >
                        <p className="text-sm text-zinc-500">Champion</p>

                        <p
                          className={`mt-1 text-lg font-bold ${
                            championId ? "text-green-300" : "text-white"
                          }`}
                        >
                          {championId
                            ? getPlayerName(championId)
                            : "Not decided yet"}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 lg:min-w-52">
                      <Link
                        href={`/tournaments/${tournament.id}`}
                        className="rounded-lg bg-red-600 px-4 py-3 text-center font-semibold text-white hover:bg-red-700"
                      >
                        View Details
                      </Link>

                      <Link
                        href="/brackets"
                        className="rounded-lg border border-zinc-700 px-4 py-3 text-center font-semibold text-white hover:bg-zinc-800"
                      >
                        View Bracket
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}