"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { checkIsAdmin } from "../../lib/admin";

type Profile = {
  id: string;
  gamer_tag: string | null;
  platform: string | null;
  favorite_team: string | null;
  is_admin: boolean | null;
};

type Tournament = {
  id: string;
  name: string;
  game: string | null;
  platform: string | null;
  created_at: string;
};

type TournamentPlayer = {
  tournament_id: string;
  player_id: string;
};

type NotificationTarget = "all" | "admins" | "players" | "tournament" | "selected";

type NotificationRow = {
  user_id: string;
  title: string;
  message: string;
  link_url: string | null;
  notification_type: string;
};

export default function AdminAnnouncementsPage() {
  const router = useRouter();

  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [tournamentPlayers, setTournamentPlayers] = useState<TournamentPlayer[]>(
    []
  );

  const [target, setTarget] = useState<NotificationTarget>("all");
  const [selectedTournamentId, setSelectedTournamentId] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [notificationType, setNotificationType] = useState("announcement");

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");

  const loadAnnouncementData = useCallback(async () => {
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

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id, gamer_tag, platform, favorite_team, is_admin")
      .order("gamer_tag", { ascending: true });

    if (profileError) {
      setMessage(`Error loading users: ${profileError.message}`);
      setProfiles([]);
    } else {
      setProfiles((profileData || []) as Profile[]);
    }

    const { data: tournamentData, error: tournamentError } = await supabase
      .from("tournaments")
      .select("id, name, game, platform, created_at")
      .order("created_at", { ascending: false });

    if (tournamentError) {
      setMessage(`Error loading tournaments: ${tournamentError.message}`);
      setTournaments([]);
    } else {
      const loadedTournaments = (tournamentData || []) as Tournament[];

      setTournaments(loadedTournaments);
      setSelectedTournamentId((currentTournamentId) => {
        const stillExists = loadedTournaments.some(
          (tournament) => tournament.id === currentTournamentId
        );

        if (currentTournamentId && stillExists) {
          return currentTournamentId;
        }

        return loadedTournaments[0]?.id || "";
      });
    }

    const { data: playerData, error: playerError } = await supabase
      .from("tournament_players")
      .select("tournament_id, player_id");

    if (playerError) {
      setMessage(`Error loading tournament players: ${playerError.message}`);
      setTournamentPlayers([]);
    } else {
      setTournamentPlayers((playerData || []) as TournamentPlayer[]);
    }

    setLoading(false);
  }, [router]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadAnnouncementData();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadAnnouncementData]);

  const adminProfiles = useMemo(() => {
    return profiles.filter((profile) => profile.is_admin);
  }, [profiles]);

  const playerProfiles = useMemo(() => {
    const playerIds = new Set(tournamentPlayers.map((row) => row.player_id));

    return profiles.filter((profile) => playerIds.has(profile.id));
  }, [profiles, tournamentPlayers]);

  const selectedTournamentPlayers = useMemo(() => {
    const playerIds = new Set(
      tournamentPlayers
        .filter((row) => row.tournament_id === selectedTournamentId)
        .map((row) => row.player_id)
    );

    return profiles.filter((profile) => playerIds.has(profile.id));
  }, [profiles, selectedTournamentId, tournamentPlayers]);

  const selectedUserProfiles = useMemo(() => {
    const selectedIds = new Set(selectedUserIds);

    return profiles.filter((profile) => selectedIds.has(profile.id));
  }, [profiles, selectedUserIds]);

  const targetProfiles = useMemo(() => {
    if (target === "admins") {
      return adminProfiles;
    }

    if (target === "players") {
      return playerProfiles;
    }

    if (target === "tournament") {
      return selectedTournamentPlayers;
    }

    if (target === "selected") {
      return selectedUserProfiles;
    }

    return profiles;
  }, [
    adminProfiles,
    playerProfiles,
    profiles,
    selectedTournamentPlayers,
    selectedUserProfiles,
    target,
  ]);

  const selectedTournament = useMemo(() => {
    return (
      tournaments.find((tournament) => tournament.id === selectedTournamentId) ||
      null
    );
  }, [selectedTournamentId, tournaments]);

  const targetCount = useMemo(() => {
    const uniqueIds = new Set(targetProfiles.map((profile) => profile.id));

    return uniqueIds.size;
  }, [targetProfiles]);

  function profileName(profile: Profile) {
    return profile.gamer_tag || "Unnamed Player";
  }

  function toggleSelectedUser(userId: string) {
    setSelectedUserIds((currentUserIds) => {
      if (currentUserIds.includes(userId)) {
        return currentUserIds.filter((id) => id !== userId);
      }

      return [...currentUserIds, userId];
    });
  }

  function clearForm() {
    setTitle("");
    setBody("");
    setLinkUrl("");
    setNotificationType("announcement");
    setSelectedUserIds([]);
    setTarget("all");
  }

  async function sendAnnouncement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!title.trim()) {
      setMessage("Announcement title is required.");
      return;
    }

    if (!body.trim()) {
      setMessage("Announcement message is required.");
      return;
    }

    if (targetCount === 0) {
      setMessage("No users match this target.");
      return;
    }

    const confirmed = window.confirm(
      `Send this announcement to ${targetCount} user(s)?`
    );

    if (!confirmed) return;

    setSending(true);
    setMessage("");

    const uniqueUserIds = Array.from(
      new Set(targetProfiles.map((profile) => profile.id))
    );

    const rowsToInsert: NotificationRow[] = uniqueUserIds.map((userId) => ({
      user_id: userId,
      title: title.trim(),
      message: body.trim(),
      link_url: linkUrl.trim() || null,
      notification_type: notificationType.trim() || "announcement",
    }));

    const { error } = await supabase.from("notifications").insert(rowsToInsert);

    if (error) {
      setMessage(`Error sending announcement: ${error.message}`);
      setSending(false);
      return;
    }

    setMessage(`Announcement sent to ${rowsToInsert.length} user(s).`);
    clearForm();
    setSending(false);
  }

  if (checkingAdmin || loading) {
    return (
      <main className="min-h-screen bg-black p-6 text-white">
        <div className="mx-auto max-w-6xl">
          <p className="rounded-xl border border-gray-800 bg-gray-950 p-6 text-gray-400">
            {checkingAdmin
              ? "Checking admin access..."
              : "Loading announcement tools..."}
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

          <Link
            href="/notifications"
            className="text-sm text-gray-400 hover:text-white"
          >
            View Notifications →
          </Link>
        </div>

        <section className="mb-8 rounded-2xl border border-gray-800 bg-gray-950 p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="mb-3 text-sm font-bold uppercase tracking-[0.25em] text-red-500">
                Admin Tools
              </p>

              <h1 className="mb-3 text-4xl font-black">Announcements</h1>

              <p className="max-w-2xl text-gray-400">
                Send manual notifications to all users, admins, tournament
                players, or selected accounts.
              </p>
            </div>

            <button
              type="button"
              onClick={loadAnnouncementData}
              disabled={loading}
              className="rounded-lg bg-white px-5 py-3 font-bold text-black hover:bg-gray-200 disabled:opacity-50"
            >
              {loading ? "Refreshing..." : "Refresh Data"}
            </button>
          </div>
        </section>

        {message && (
          <p className="mb-6 rounded-lg border border-yellow-800 bg-yellow-950/30 p-4 text-sm text-yellow-200">
            {message}
          </p>
        )}

        <section className="mb-8 grid gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-gray-800 bg-gray-950 p-5">
            <p className="text-sm text-gray-500">All Users</p>
            <p className="mt-2 text-4xl font-black">{profiles.length}</p>
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-950 p-5">
            <p className="text-sm text-gray-500">Admins</p>
            <p className="mt-2 text-4xl font-black">{adminProfiles.length}</p>
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-950 p-5">
            <p className="text-sm text-gray-500">Players</p>
            <p className="mt-2 text-4xl font-black">{playerProfiles.length}</p>
          </div>

          <div className="rounded-xl border border-red-800 bg-red-950/20 p-5">
            <p className="text-sm text-red-300">Current Target</p>
            <p className="mt-2 text-4xl font-black">{targetCount}</p>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[420px_1fr]">
          <aside className="rounded-xl border border-gray-800 bg-gray-950 p-6">
            <h2 className="mb-5 text-2xl font-bold">Target Audience</h2>

            <div className="grid gap-3">
              <label className="rounded-lg border border-gray-800 bg-black p-4">
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    checked={target === "all"}
                    onChange={() => setTarget("all")}
                  />
                  <span className="font-bold">All Users</span>
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  Send to every account in profiles.
                </p>
              </label>

              <label className="rounded-lg border border-gray-800 bg-black p-4">
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    checked={target === "admins"}
                    onChange={() => setTarget("admins")}
                  />
                  <span className="font-bold">Admins Only</span>
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  Send to users with admin access.
                </p>
              </label>

              <label className="rounded-lg border border-gray-800 bg-black p-4">
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    checked={target === "players"}
                    onChange={() => setTarget("players")}
                  />
                  <span className="font-bold">All Tournament Players</span>
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  Send to anyone who has joined at least one tournament.
                </p>
              </label>

              <label className="rounded-lg border border-gray-800 bg-black p-4">
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    checked={target === "tournament"}
                    onChange={() => setTarget("tournament")}
                  />
                  <span className="font-bold">Specific Tournament</span>
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  Send to players registered for one tournament.
                </p>
              </label>

              {target === "tournament" && (
                <div>
                  <label className="mb-2 block text-sm text-gray-400">
                    Tournament
                  </label>

                  <select
                    className="w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                    value={selectedTournamentId}
                    onChange={(event) =>
                      setSelectedTournamentId(event.target.value)
                    }
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

                  {selectedTournament && (
                    <p className="mt-2 text-xs text-gray-500">
                      {selectedTournament.game || "Game not set"} •{" "}
                      {selectedTournament.platform || "Platform not set"}
                    </p>
                  )}
                </div>
              )}

              <label className="rounded-lg border border-gray-800 bg-black p-4">
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    checked={target === "selected"}
                    onChange={() => setTarget("selected")}
                  />
                  <span className="font-bold">Selected Users</span>
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  Manually choose exact users below.
                </p>
              </label>
            </div>
          </aside>

          <section className="rounded-xl border border-gray-800 bg-gray-950 p-6">
            <h2 className="mb-5 text-2xl font-bold">Create Announcement</h2>

            <form onSubmit={sendAnnouncement} className="grid gap-4">
              <div>
                <label className="mb-2 block text-sm text-gray-400">Title</label>

                <input
                  className="w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                  placeholder="Tournament Update"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-gray-400">
                  Message
                </label>

                <textarea
                  className="min-h-36 w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                  placeholder="Write your announcement..."
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm text-gray-400">
                    Optional Link URL
                  </label>

                  <input
                    className="w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                    placeholder="/tournaments"
                    value={linkUrl}
                    onChange={(event) => setLinkUrl(event.target.value)}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm text-gray-400">
                    Notification Type
                  </label>

                  <input
                    className="w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                    placeholder="announcement"
                    value={notificationType}
                    onChange={(event) => setNotificationType(event.target.value)}
                  />
                </div>
              </div>

              {target === "selected" && (
                <section className="rounded-xl border border-gray-800 bg-black p-4">
                  <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div>
                      <h3 className="text-xl font-bold">Select Users</h3>

                      <p className="mt-1 text-sm text-gray-500">
                        {selectedUserIds.length} user(s) selected.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedUserIds([])}
                      className="rounded-lg border border-gray-700 px-4 py-2 text-sm font-bold text-white hover:bg-gray-900"
                    >
                      Clear Selected
                    </button>
                  </div>

                  {profiles.length === 0 ? (
                    <p className="rounded-lg border border-gray-800 bg-gray-950 p-4 text-gray-400">
                      No users found.
                    </p>
                  ) : (
                    <div className="max-h-96 overflow-auto pr-2">
                      <div className="grid gap-3 md:grid-cols-2">
                        {profiles.map((profile) => (
                          <label
                            key={profile.id}
                            className="rounded-lg border border-gray-800 bg-gray-950 p-4"
                          >
                            <div className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                checked={selectedUserIds.includes(profile.id)}
                                onChange={() => toggleSelectedUser(profile.id)}
                              />

                              <div>
                                <p className="font-bold">{profileName(profile)}</p>

                                <p className="mt-1 text-xs text-gray-500">
                                  {profile.platform || "Platform not set"} •{" "}
                                  {profile.favorite_team ||
                                    "Favorite team not set"}
                                </p>

                                {profile.is_admin && (
                                  <p className="mt-2 text-xs font-bold text-red-300">
                                    Admin
                                  </p>
                                )}
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              )}

              <section className="rounded-xl border border-red-900 bg-red-950/10 p-4">
                <h3 className="mb-2 text-lg font-bold text-red-200">
                  Send Preview
                </h3>

                <p className="text-sm text-gray-400">
                  This will send to{" "}
                  <span className="font-bold text-white">{targetCount}</span>{" "}
                  user(s).
                </p>

                <p className="mt-2 text-sm text-gray-500">
                  Target:{" "}
                  {target === "all"
                    ? "All Users"
                    : target === "admins"
                      ? "Admins Only"
                      : target === "players"
                        ? "All Tournament Players"
                        : target === "tournament"
                          ? selectedTournament?.name || "Selected Tournament"
                          : "Selected Users"}
                </p>
              </section>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="submit"
                  disabled={sending}
                  className="rounded-lg bg-white px-5 py-3 font-bold text-black hover:bg-gray-200 disabled:opacity-50"
                >
                  {sending ? "Sending..." : "Send Announcement"}
                </button>

                <button
                  type="button"
                  onClick={clearForm}
                  className="rounded-lg border border-gray-700 px-5 py-3 font-bold text-white hover:bg-gray-900"
                >
                  Clear Form
                </button>
              </div>
            </form>
          </section>
        </section>
      </div>
    </main>
  );
}