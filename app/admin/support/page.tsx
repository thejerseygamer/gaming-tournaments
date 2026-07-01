"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { checkIsAdmin } from "../../lib/admin";

type SupportRequest = {
  id: string;
  user_id: string;
  contact_email: string | null;
  category: string;
  subject: string;
  message: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
};

type Profile = {
  id: string;
  gamer_tag: string | null;
  platform: string | null;
  favorite_team: string | null;
  is_admin: boolean | null;
};

type StatusFilter = "all" | "open" | "in_progress" | "closed";
type SortOption = "newest" | "oldest" | "updated";

const categoryLabels: Record<string, string> = {
  general: "General Question",
  tournament: "Tournament Help",
  score: "Score / Match Issue",
  account: "Account Help",
  bug: "Bug Report",
};

function formatDateTime(value: string | null) {
  if (!value) return "Not set";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not set";

  return date.toLocaleString();
}

function statusLabel(status: string) {
  if (status === "closed") return "Closed";
  if (status === "in_progress") return "In Progress";

  return "Open";
}

function statusClass(status: string) {
  if (status === "closed") {
    return "border-green-700 bg-green-950/30 text-green-300";
  }

  if (status === "in_progress") {
    return "border-yellow-700 bg-yellow-950/30 text-yellow-300";
  }

  return "border-red-700 bg-red-950/30 text-red-300";
}

function categoryLabel(category: string) {
  return categoryLabels[category] || "General Question";
}

export default function AdminSupportInboxPage() {
  const router = useRouter();

  const [isAdmin, setIsAdmin] = useState(false);
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, Profile>>({});
  const [notesDrafts, setNotesDrafts] = useState<Record<string, string>>({});

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [search, setSearch] = useState("");

  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [message, setMessage] = useState("");

  const loadSupportInbox = useCallback(async () => {
    setCheckingAdmin(true);
    setLoading(true);
    setMessage("");

    const adminCheck = await checkIsAdmin();

    if (!adminCheck.user) {
      setCheckingAdmin(false);
      setLoading(false);
      router.push("/login");
      return;
    }

    if (!adminCheck.isAdmin) {
      setCheckingAdmin(false);
      setLoading(false);
      router.push("/tournaments");
      return;
    }

    setIsAdmin(true);
    setCheckingAdmin(false);

    const { data: requestData, error: requestError } = await supabase
      .from("support_requests")
      .select(
        "id, user_id, contact_email, category, subject, message, status, admin_notes, created_at, updated_at"
      )
      .order("created_at", { ascending: false });

    if (requestError) {
      setMessage(`Error loading support requests: ${requestError.message}`);
      setRequests([]);
      setProfilesById({});
      setNotesDrafts({});
      setLoading(false);
      return;
    }

    const loadedRequests = (requestData || []) as SupportRequest[];

    setRequests(loadedRequests);

    const nextNotesDrafts = loadedRequests.reduce((acc, request) => {
      acc[request.id] = request.admin_notes || "";
      return acc;
    }, {} as Record<string, string>);

    setNotesDrafts(nextNotesDrafts);

    const userIds = Array.from(
      new Set(loadedRequests.map((request) => request.user_id))
    );

    if (userIds.length === 0) {
      setProfilesById({});
      setLoading(false);
      return;
    }

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id, gamer_tag, platform, favorite_team, is_admin")
      .in("id", userIds);

    if (profileError) {
      setProfilesById({});
      setMessage(
        "Support requests loaded, but player profile details could not load."
      );
      setLoading(false);
      return;
    }

    const nextProfilesById = ((profileData || []) as Profile[]).reduce(
      (acc, profile) => {
        acc[profile.id] = profile;
        return acc;
      },
      {} as Record<string, Profile>
    );

    setProfilesById(nextProfilesById);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadSupportInbox();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadSupportInbox]);

  const openCount = useMemo(() => {
    return requests.filter((request) => request.status === "open").length;
  }, [requests]);

  const inProgressCount = useMemo(() => {
    return requests.filter((request) => request.status === "in_progress")
      .length;
  }, [requests]);

  const closedCount = useMemo(() => {
    return requests.filter((request) => request.status === "closed").length;
  }, [requests]);

  const filteredRequests = useMemo(() => {
    const cleanSearch = search.trim().toLowerCase();

    const searchedRequests = requests.filter((request) => {
      const profile = profilesById[request.user_id];

      const playerName = profile?.gamer_tag?.toLowerCase() || "";
      const platform = profile?.platform?.toLowerCase() || "";
      const favoriteTeam = profile?.favorite_team?.toLowerCase() || "";
      const contactEmail = request.contact_email?.toLowerCase() || "";
      const subject = request.subject.toLowerCase();
      const body = request.message.toLowerCase();
      const category = categoryLabel(request.category).toLowerCase();
      const status = statusLabel(request.status).toLowerCase();

      const matchesSearch =
        !cleanSearch ||
        playerName.includes(cleanSearch) ||
        platform.includes(cleanSearch) ||
        favoriteTeam.includes(cleanSearch) ||
        contactEmail.includes(cleanSearch) ||
        subject.includes(cleanSearch) ||
        body.includes(cleanSearch) ||
        category.includes(cleanSearch) ||
        status.includes(cleanSearch);

      const matchesStatus =
        statusFilter === "all" || request.status === statusFilter;

      return matchesSearch && matchesStatus;
    });

    const sortedRequests = [...searchedRequests];

    sortedRequests.sort((a, b) => {
      if (sortBy === "oldest") {
        return (
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      }

      if (sortBy === "updated") {
        return (
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        );
      }

      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return sortedRequests;
  }, [profilesById, requests, search, sortBy, statusFilter]);

  function playerName(userId: string) {
    return profilesById[userId]?.gamer_tag || "Unnamed Player";
  }

  function playerMeta(userId: string) {
    const profile = profilesById[userId];

    if (!profile) return "Profile details not loaded";

    return `${profile.platform || "Platform not set"} • ${
      profile.favorite_team || "Favorite team not set"
    }`;
  }

  function setNotesDraft(requestId: string, value: string) {
    setNotesDrafts((currentDrafts) => ({
      ...currentDrafts,
      [requestId]: value,
    }));
  }

  async function updateSupportRequest(
    request: SupportRequest,
    nextStatus: string
  ) {
    if (!isAdmin) {
      setMessage("You do not have admin access.");
      return;
    }

    setSavingId(request.id);
    setMessage("");

    const { error } = await supabase
      .from("support_requests")
      .update({
        status: nextStatus,
        admin_notes: notesDrafts[request.id]?.trim() || null,
      })
      .eq("id", request.id);

    if (error) {
      setMessage(`Error updating support request: ${error.message}`);
      setSavingId("");
      return;
    }

    setMessage("Support request updated.");
    await loadSupportInbox();
    setSavingId("");
  }

  async function saveNotesOnly(request: SupportRequest) {
    if (!isAdmin) {
      setMessage("You do not have admin access.");
      return;
    }

    setSavingId(request.id);
    setMessage("");

    const { error } = await supabase
      .from("support_requests")
      .update({
        admin_notes: notesDrafts[request.id]?.trim() || null,
      })
      .eq("id", request.id);

    if (error) {
      setMessage(`Error saving notes: ${error.message}`);
      setSavingId("");
      return;
    }

    setMessage("Admin notes saved.");
    await loadSupportInbox();
    setSavingId("");
  }

  if (checkingAdmin || loading) {
    return (
      <main className="min-h-screen bg-black p-6 text-white">
        <div className="mx-auto max-w-6xl">
          <p className="rounded-xl border border-gray-800 bg-gray-950 p-6 text-gray-400">
            {checkingAdmin
              ? "Checking admin access..."
              : "Loading support inbox..."}
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

          <Link href="/support" className="text-sm text-gray-400 hover:text-white">
            User Support Page →
          </Link>
        </div>

        <section className="mb-8 rounded-2xl border border-gray-800 bg-gray-950 p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="mb-3 text-sm font-bold uppercase tracking-[0.25em] text-red-500">
                Admin Tools
              </p>

              <h1 className="mb-3 text-4xl font-black">Support Inbox</h1>

              <p className="max-w-2xl text-gray-400">
                Review player support requests, update statuses, and leave admin
                notes visible to the user.
              </p>
            </div>

            <button
              type="button"
              onClick={loadSupportInbox}
              disabled={loading}
              className="rounded-lg bg-white px-5 py-3 font-bold text-black hover:bg-gray-200 disabled:opacity-50"
            >
              {loading ? "Refreshing..." : "Refresh Inbox"}
            </button>
          </div>
        </section>

        {message && (
          <p className="mb-6 rounded-lg border border-yellow-800 bg-yellow-950/30 p-4 text-sm text-yellow-200">
            {message}
          </p>
        )}

        <section className="mb-8 grid gap-4 md:grid-cols-4">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`rounded-xl border p-5 text-left ${
              statusFilter === "all"
                ? "border-red-700 bg-red-950/30"
                : "border-gray-800 bg-gray-950 hover:bg-gray-900"
            }`}
          >
            <p className="text-sm text-gray-500">Total</p>
            <p className="mt-2 text-4xl font-black">{requests.length}</p>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("open")}
            className={`rounded-xl border p-5 text-left ${
              statusFilter === "open"
                ? "border-red-700 bg-red-950/30"
                : "border-gray-800 bg-gray-950 hover:bg-gray-900"
            }`}
          >
            <p className="text-sm text-red-300">Open</p>
            <p className="mt-2 text-4xl font-black">{openCount}</p>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("in_progress")}
            className={`rounded-xl border p-5 text-left ${
              statusFilter === "in_progress"
                ? "border-red-700 bg-red-950/30"
                : "border-gray-800 bg-gray-950 hover:bg-gray-900"
            }`}
          >
            <p className="text-sm text-yellow-300">In Progress</p>
            <p className="mt-2 text-4xl font-black">{inProgressCount}</p>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("closed")}
            className={`rounded-xl border p-5 text-left ${
              statusFilter === "closed"
                ? "border-red-700 bg-red-950/30"
                : "border-gray-800 bg-gray-950 hover:bg-gray-900"
            }`}
          >
            <p className="text-sm text-green-300">Closed</p>
            <p className="mt-2 text-4xl font-black">{closedCount}</p>
          </button>
        </section>

        <section className="mb-6 rounded-xl border border-gray-800 bg-gray-950 p-5">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm text-gray-400">
                Search Requests
              </label>

              <input
                className="w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                placeholder="Search player, email, subject, message..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-gray-400">
                Status
              </label>

              <select
                className="w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as StatusFilter)
                }
              >
                <option value="all">All Statuses</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm text-gray-400">
                Sort By
              </label>

              <select
                className="w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as SortOption)}
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="updated">Recently Updated</option>
              </select>
            </div>
          </div>
        </section>

        {filteredRequests.length === 0 ? (
          <section className="rounded-xl border border-gray-800 bg-gray-950 p-6">
            <h2 className="mb-2 text-2xl font-bold">No support requests found</h2>

            <p className="mb-5 text-gray-400">
              Try changing the search text or status filter.
            </p>

            <button
              type="button"
              onClick={() => {
                setSearch("");
                setStatusFilter("all");
                setSortBy("newest");
              }}
              className="rounded-lg bg-white px-5 py-3 font-bold text-black hover:bg-gray-200"
            >
              Clear Filters
            </button>
          </section>
        ) : (
          <section className="grid gap-5">
            {filteredRequests.map((request) => (
              <article
                key={request.id}
                className="rounded-xl border border-gray-800 bg-gray-950 p-5"
              >
                <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="mb-3 flex flex-wrap gap-2">
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-bold ${statusClass(
                          request.status
                        )}`}
                      >
                        {statusLabel(request.status)}
                      </span>

                      <span className="rounded-full border border-gray-700 bg-black px-3 py-1 text-xs font-bold text-gray-300">
                        {categoryLabel(request.category)}
                      </span>
                    </div>

                    <h2 className="text-2xl font-black">{request.subject}</h2>

                    <p className="mt-2 text-sm text-gray-500">
                      From{" "}
                      <Link
                        href={`/players/${request.user_id}`}
                        className="font-bold text-white hover:text-red-300"
                      >
                        {playerName(request.user_id)}
                      </Link>{" "}
                      • {playerMeta(request.user_id)}
                    </p>

                    {request.contact_email && (
                      <p className="mt-1 break-all text-sm text-gray-500">
                        Contact: {request.contact_email}
                      </p>
                    )}
                  </div>

                  <div className="text-left text-sm text-gray-500 lg:text-right">
                    <p>Created: {formatDateTime(request.created_at)}</p>
                    <p className="mt-1">
                      Updated: {formatDateTime(request.updated_at)}
                    </p>
                  </div>
                </div>

                <section className="mb-5 rounded-xl border border-gray-800 bg-black p-4">
                  <p className="mb-2 text-sm font-bold text-gray-300">
                    Player Message
                  </p>

                  <p className="whitespace-pre-wrap text-sm leading-6 text-gray-400">
                    {request.message}
                  </p>
                </section>

                <section className="grid gap-4 lg:grid-cols-[1fr_260px]">
                  <div>
                    <label className="mb-2 block text-sm text-gray-400">
                      Admin Notes
                    </label>

                    <textarea
                      className="min-h-32 w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                      placeholder="Write notes or a response for the user..."
                      value={notesDrafts[request.id] || ""}
                      onChange={(event) =>
                        setNotesDraft(request.id, event.target.value)
                      }
                    />
                  </div>

                  <div className="grid content-end gap-3">
                    <button
                      type="button"
                      onClick={() => saveNotesOnly(request)}
                      disabled={savingId === request.id}
                      className="rounded-lg border border-gray-700 px-5 py-3 text-sm font-bold text-white hover:bg-gray-900 disabled:opacity-50"
                    >
                      {savingId === request.id ? "Saving..." : "Save Notes"}
                    </button>

                    <button
                      type="button"
                      onClick={() => updateSupportRequest(request, "open")}
                      disabled={savingId === request.id}
                      className="rounded-lg border border-red-700 px-5 py-3 text-sm font-bold text-red-300 hover:bg-red-950/40 disabled:opacity-50"
                    >
                      Mark Open
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        updateSupportRequest(request, "in_progress")
                      }
                      disabled={savingId === request.id}
                      className="rounded-lg border border-yellow-700 px-5 py-3 text-sm font-bold text-yellow-300 hover:bg-yellow-950/40 disabled:opacity-50"
                    >
                      Mark In Progress
                    </button>

                    <button
                      type="button"
                      onClick={() => updateSupportRequest(request, "closed")}
                      disabled={savingId === request.id}
                      className="rounded-lg bg-white px-5 py-3 text-sm font-bold text-black hover:bg-gray-200 disabled:opacity-50"
                    >
                      Mark Closed
                    </button>
                  </div>
                </section>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}