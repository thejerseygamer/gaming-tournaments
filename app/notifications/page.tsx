"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type NotificationRow = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  link_url: string | null;
  notification_type: string | null;
  read_at: string | null;
  created_at: string;
};

type FilterType = "all" | "unread" | "read";

function formatDateTime(value: string | null) {
  if (!value) return "Not set";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not set";

  return date.toLocaleString();
}

export default function NotificationsPage() {
  const router = useRouter();

  const [userId, setUserId] = useState("");
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [filter, setFilter] = useState<FilterType>("all");

  const [loading, setLoading] = useState(true);
  const [markingId, setMarkingId] = useState("");
  const [markingAll, setMarkingAll] = useState(false);
  const [message, setMessage] = useState("");

  const loadNotifications = useCallback(async () => {
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

    const { data, error } = await supabase
      .from("notifications")
      .select(
        "id, user_id, title, message, link_url, notification_type, read_at, created_at"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(`Error loading notifications: ${error.message}`);
      setNotifications([]);
      setLoading(false);
      return;
    }

    setNotifications((data || []) as NotificationRow[]);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadNotifications();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadNotifications]);

  const unreadCount = useMemo(() => {
    return notifications.filter((notification) => !notification.read_at).length;
  }, [notifications]);

  const readCount = useMemo(() => {
    return notifications.filter((notification) => notification.read_at).length;
  }, [notifications]);

  const filteredNotifications = useMemo(() => {
    if (filter === "unread") {
      return notifications.filter((notification) => !notification.read_at);
    }

    if (filter === "read") {
      return notifications.filter((notification) => notification.read_at);
    }

    return notifications;
  }, [filter, notifications]);

  function notificationTypeLabel(type: string | null) {
    if (!type) return "Notification";

    return type
      .split("_")
      .map((word) => {
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(" ");
  }

  function notificationStatusClass(notification: NotificationRow) {
    if (!notification.read_at) {
      return "border-red-700 bg-red-950/20";
    }

    return "border-gray-800 bg-black";
  }

  async function markAsRead(notification: NotificationRow) {
    if (!userId) {
      router.push("/login");
      return;
    }

    if (notification.read_at) {
      setMessage("This notification is already marked as read.");
      return;
    }

    setMarkingId(notification.id);
    setMessage("");

    const { error } = await supabase
      .from("notifications")
      .update({
        read_at: new Date().toISOString(),
      })
      .eq("id", notification.id)
      .eq("user_id", userId);

    if (error) {
      setMessage(`Error marking notification as read: ${error.message}`);
      setMarkingId("");
      return;
    }

    await loadNotifications();
    setMarkingId("");
  }

  async function markAsUnread(notification: NotificationRow) {
    if (!userId) {
      router.push("/login");
      return;
    }

    if (!notification.read_at) {
      setMessage("This notification is already unread.");
      return;
    }

    setMarkingId(notification.id);
    setMessage("");

    const { error } = await supabase
      .from("notifications")
      .update({
        read_at: null,
      })
      .eq("id", notification.id)
      .eq("user_id", userId);

    if (error) {
      setMessage(`Error marking notification as unread: ${error.message}`);
      setMarkingId("");
      return;
    }

    await loadNotifications();
    setMarkingId("");
  }

  async function markAllAsRead() {
    if (!userId) {
      router.push("/login");
      return;
    }

    if (unreadCount === 0) {
      setMessage("You do not have any unread notifications.");
      return;
    }

    setMarkingAll(true);
    setMessage("");

    const { error } = await supabase
      .from("notifications")
      .update({
        read_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .is("read_at", null);

    if (error) {
      setMessage(`Error marking all as read: ${error.message}`);
      setMarkingAll(false);
      return;
    }

    setMessage("All notifications marked as read.");
    await loadNotifications();
    setMarkingAll(false);
  }

  return (
    <main className="min-h-screen bg-black p-6 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Link href="/" className="text-sm text-gray-400 hover:text-white">
            ← Back Home
          </Link>

          <Link
            href="/my-tournaments"
            className="text-sm text-gray-400 hover:text-white"
          >
            My Tournaments →
          </Link>
        </div>

        <section className="mb-8 rounded-2xl border border-gray-800 bg-gray-950 p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="mb-3 text-sm font-bold uppercase tracking-[0.25em] text-red-500">
                BattleGrid Alerts
              </p>

              <h1 className="mb-3 text-4xl font-black">Notifications</h1>

              <p className="max-w-2xl text-gray-400">
                Track tournament updates, match results, score reviews, and admin
                announcements.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={loadNotifications}
                disabled={loading}
                className="rounded-lg border border-gray-700 px-5 py-3 font-bold text-white hover:bg-gray-900 disabled:opacity-50"
              >
                {loading ? "Refreshing..." : "Refresh"}
              </button>

              <button
                type="button"
                onClick={markAllAsRead}
                disabled={markingAll || unreadCount === 0}
                className="rounded-lg bg-white px-5 py-3 font-bold text-black hover:bg-gray-200 disabled:opacity-50"
              >
                {markingAll ? "Marking..." : "Mark All Read"}
              </button>
            </div>
          </div>
        </section>

        {message && (
          <p className="mb-6 rounded-lg border border-yellow-800 bg-yellow-950/30 p-4 text-sm text-yellow-200">
            {message}
          </p>
        )}

        <section className="mb-8 grid gap-4 md:grid-cols-3">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`rounded-xl border p-5 text-left ${
              filter === "all"
                ? "border-red-700 bg-red-950/30"
                : "border-gray-800 bg-gray-950 hover:bg-gray-900"
            }`}
          >
            <p className="text-sm text-gray-500">All</p>
            <p className="mt-2 text-4xl font-black">{notifications.length}</p>
          </button>

          <button
            type="button"
            onClick={() => setFilter("unread")}
            className={`rounded-xl border p-5 text-left ${
              filter === "unread"
                ? "border-red-700 bg-red-950/30"
                : "border-gray-800 bg-gray-950 hover:bg-gray-900"
            }`}
          >
            <p className="text-sm text-gray-500">Unread</p>
            <p className="mt-2 text-4xl font-black">{unreadCount}</p>
          </button>

          <button
            type="button"
            onClick={() => setFilter("read")}
            className={`rounded-xl border p-5 text-left ${
              filter === "read"
                ? "border-red-700 bg-red-950/30"
                : "border-gray-800 bg-gray-950 hover:bg-gray-900"
            }`}
          >
            <p className="text-sm text-gray-500">Read</p>
            <p className="mt-2 text-4xl font-black">{readCount}</p>
          </button>
        </section>

        {loading ? (
          <p className="rounded-xl border border-gray-800 bg-gray-950 p-6 text-gray-400">
            Loading notifications...
          </p>
        ) : filteredNotifications.length === 0 ? (
          <section className="rounded-xl border border-gray-800 bg-gray-950 p-6">
            <h2 className="mb-2 text-2xl font-bold">No notifications found</h2>

            <p className="mb-5 text-gray-400">
              Tournament updates, score decisions, match updates, and
              announcements will appear here.
            </p>

            <Link
              href="/tournaments"
              className="inline-block rounded-lg bg-white px-5 py-3 font-bold text-black hover:bg-gray-200"
            >
              Browse Tournaments
            </Link>
          </section>
        ) : (
          <section className="grid gap-4">
            {filteredNotifications.map((notification) => (
              <article
                key={notification.id}
                className={`rounded-xl border p-5 ${notificationStatusClass(
                  notification
                )}`}
              >
                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      {!notification.read_at && (
                        <span className="rounded-full bg-red-600 px-2 py-1 text-xs font-black text-white">
                          New
                        </span>
                      )}

                      <span className="rounded-full border border-gray-700 bg-black px-2 py-1 text-xs font-bold text-gray-300">
                        {notificationTypeLabel(notification.notification_type)}
                      </span>
                    </div>

                    <h2 className="text-2xl font-bold">
                      {notification.title}
                    </h2>

                    <p className="mt-2 whitespace-pre-wrap text-gray-400">
                      {notification.message}
                    </p>
                  </div>

                  <div className="text-left md:text-right">
                    <p className="text-sm text-gray-500">
                      {formatDateTime(notification.created_at)}
                    </p>

                    {notification.read_at && (
                      <p className="mt-1 text-xs text-gray-600">
                        Read: {formatDateTime(notification.read_at)}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  {notification.link_url && (
                    <Link
                      href={notification.link_url}
                      onClick={() => {
                        if (!notification.read_at) {
                          void markAsRead(notification);
                        }
                      }}
                      className="rounded-lg bg-white px-5 py-3 text-center text-sm font-bold text-black hover:bg-gray-200"
                    >
                      Open
                    </Link>
                  )}

                  {!notification.read_at ? (
                    <button
                      type="button"
                      onClick={() => markAsRead(notification)}
                      disabled={markingId === notification.id}
                      className="rounded-lg border border-gray-700 px-5 py-3 text-sm font-bold text-white hover:bg-gray-900 disabled:opacity-50"
                    >
                      {markingId === notification.id
                        ? "Marking..."
                        : "Mark Read"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => markAsUnread(notification)}
                      disabled={markingId === notification.id}
                      className="rounded-lg border border-gray-700 px-5 py-3 text-sm font-bold text-white hover:bg-gray-900 disabled:opacity-50"
                    >
                      {markingId === notification.id
                        ? "Marking..."
                        : "Mark Unread"}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}