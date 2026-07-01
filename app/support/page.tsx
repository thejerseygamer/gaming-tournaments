"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

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

type CategoryOption = {
  value: string;
  label: string;
};

const categoryOptions: CategoryOption[] = [
  {
    value: "general",
    label: "General Question",
  },
  {
    value: "tournament",
    label: "Tournament Help",
  },
  {
    value: "score",
    label: "Score / Match Issue",
  },
  {
    value: "account",
    label: "Account Help",
  },
  {
    value: "bug",
    label: "Bug Report",
  },
];

function formatDateTime(value: string | null) {
  if (!value) return "Not set";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not set";

  return date.toLocaleString();
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

function statusLabel(status: string) {
  if (status === "closed") return "Closed";
  if (status === "in_progress") return "In Progress";

  return "Open";
}

function categoryLabel(value: string) {
  return (
    categoryOptions.find((option) => option.value === value)?.label ||
    "General Question"
  );
}

export default function SupportPage() {
  const router = useRouter();

  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");

  const [requests, setRequests] = useState<SupportRequest[]>([]);

  const [category, setCategory] = useState("general");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const loadSupportPage = useCallback(async () => {
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
    setUserEmail(user.email || "");

    const { data, error } = await supabase
      .from("support_requests")
      .select(
        "id, user_id, contact_email, category, subject, message, status, admin_notes, created_at, updated_at"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(`Error loading support requests: ${error.message}`);
      setRequests([]);
      setLoading(false);
      return;
    }

    setRequests((data || []) as SupportRequest[]);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadSupportPage();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadSupportPage]);

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

  async function submitSupportRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!userId) {
      router.push("/login");
      return;
    }

    if (!subject.trim()) {
      setMessage("Subject is required.");
      return;
    }

    if (!body.trim()) {
      setMessage("Message is required.");
      return;
    }

    setSubmitting(true);
    setMessage("");

    const { error } = await supabase.from("support_requests").insert({
      user_id: userId,
      contact_email: userEmail || null,
      category,
      subject: subject.trim(),
      message: body.trim(),
      status: "open",
    });

    if (error) {
      setMessage(`Error sending support request: ${error.message}`);
      setSubmitting(false);
      return;
    }

    setCategory("general");
    setSubject("");
    setBody("");
    setMessage("Support request sent. An admin will review it.");
    await loadSupportPage();
    setSubmitting(false);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black p-6 text-white">
        <div className="mx-auto max-w-6xl">
          <p className="rounded-xl border border-gray-800 bg-gray-950 p-6 text-gray-400">
            Loading support center...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black p-6 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Link href="/help" className="text-sm text-gray-400 hover:text-white">
            ← Back to Help
          </Link>

          <Link
            href="/my-tournaments"
            className="text-sm text-gray-400 hover:text-white"
          >
            My Tournaments →
          </Link>
        </div>

        <section className="mb-8 rounded-3xl border border-red-900/60 bg-red-950/20 p-8">
          <p className="mb-3 text-sm font-black uppercase tracking-[0.3em] text-red-400">
            BattleGrid Support
          </p>

          <h1 className="mb-4 text-5xl font-black">Support Center</h1>

          <p className="max-w-3xl text-lg leading-8 text-gray-300">
            Need help with a tournament, score, bracket, account, or bug? Send a
            request to the BattleGrid admin team.
          </p>
        </section>

        {message && (
          <p className="mb-6 rounded-lg border border-yellow-800 bg-yellow-950/30 p-4 text-sm text-yellow-200">
            {message}
          </p>
        )}

        <section className="mb-8 grid gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-gray-800 bg-gray-950 p-5">
            <p className="text-sm text-gray-500">Total Requests</p>
            <p className="mt-2 text-4xl font-black">{requests.length}</p>
          </div>

          <div className="rounded-xl border border-red-800 bg-red-950/20 p-5">
            <p className="text-sm text-red-300">Open</p>
            <p className="mt-2 text-4xl font-black">{openCount}</p>
          </div>

          <div className="rounded-xl border border-yellow-800 bg-yellow-950/20 p-5">
            <p className="text-sm text-yellow-300">In Progress</p>
            <p className="mt-2 text-4xl font-black">{inProgressCount}</p>
          </div>

          <div className="rounded-xl border border-green-800 bg-green-950/20 p-5">
            <p className="text-sm text-green-300">Closed</p>
            <p className="mt-2 text-4xl font-black">{closedCount}</p>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_420px]">
          <section className="rounded-xl border border-gray-800 bg-gray-950 p-6">
            <h2 className="mb-5 text-2xl font-bold">Create Support Request</h2>

            <form onSubmit={submitSupportRequest} className="grid gap-4">
              <div>
                <label className="mb-2 block text-sm text-gray-400">
                  Category
                </label>

                <select
                  className="w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                >
                  {categoryOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm text-gray-400">
                  Subject
                </label>

                <input
                  className="w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                  placeholder="Example: My score is wrong"
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-gray-400">
                  Message
                </label>

                <textarea
                  className="min-h-44 w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                  placeholder="Explain what happened. Include tournament name, opponent, match round, or anything useful."
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-white px-5 py-3 font-bold text-black hover:bg-gray-200 disabled:opacity-50"
              >
                {submitting ? "Sending..." : "Send Support Request"}
              </button>
            </form>
          </section>

          <aside className="grid h-fit gap-6">
            <section className="rounded-xl border border-gray-800 bg-gray-950 p-6">
              <h2 className="mb-4 text-2xl font-bold">Before You Submit</h2>

              <div className="grid gap-4 text-sm leading-6 text-gray-400">
                <p>
                  For score issues, include the tournament name, opponent, round,
                  match number, and final score.
                </p>

                <p>
                  For account issues, include what page you were on and what
                  error message you saw.
                </p>

                <p>
                  For bugs, describe what you clicked and what happened after.
                </p>
              </div>
            </section>

            <section className="rounded-xl border border-gray-800 bg-gray-950 p-6">
              <h2 className="mb-4 text-2xl font-bold">Account</h2>

              <p className="text-sm text-gray-500">Signed in as</p>

              <p className="mt-2 break-all font-bold">{userEmail || "Not set"}</p>
            </section>
          </aside>
        </section>

        <section className="mt-8 rounded-xl border border-gray-800 bg-gray-950 p-6">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-2xl font-bold">My Support Requests</h2>

              <p className="mt-1 text-sm text-gray-400">
                Track requests you have sent to the admin team.
              </p>
            </div>

            <button
              type="button"
              onClick={loadSupportPage}
              disabled={loading}
              className="rounded-lg border border-gray-700 px-5 py-3 font-bold text-white hover:bg-gray-900 disabled:opacity-50"
            >
              Refresh
            </button>
          </div>

          {requests.length === 0 ? (
            <p className="rounded-lg border border-gray-800 bg-black p-4 text-gray-400">
              You have not sent any support requests yet.
            </p>
          ) : (
            <div className="grid gap-4">
              {requests.map((request) => (
                <article
                  key={request.id}
                  className="rounded-xl border border-gray-800 bg-black p-5"
                >
                  <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="mb-2 flex flex-wrap gap-2">
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-bold ${statusClass(
                            request.status
                          )}`}
                        >
                          {statusLabel(request.status)}
                        </span>

                        <span className="rounded-full border border-gray-700 bg-gray-950 px-3 py-1 text-xs font-bold text-gray-300">
                          {categoryLabel(request.category)}
                        </span>
                      </div>

                      <h3 className="text-xl font-black">{request.subject}</h3>

                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-400">
                        {request.message}
                      </p>
                    </div>

                    <p className="text-sm text-gray-500">
                      {formatDateTime(request.created_at)}
                    </p>
                  </div>

                  {request.admin_notes && (
                    <div className="rounded-lg border border-yellow-800 bg-yellow-950/20 p-4">
                      <p className="mb-2 text-sm font-bold text-yellow-300">
                        Admin Notes
                      </p>

                      <p className="whitespace-pre-wrap text-sm leading-6 text-gray-300">
                        {request.admin_notes}
                      </p>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}