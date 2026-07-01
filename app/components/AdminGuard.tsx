"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type AdminGuardProps = {
  children: React.ReactNode;
};

export default function AdminGuard({ children }: AdminGuardProps) {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const adminEmails = useMemo(() => {
    const rawEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS || "";

    return rawEmails
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);
  }, []);

  useEffect(() => {
    let active = true;

    async function checkAdminAccess() {
      await Promise.resolve();

      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (!active) {
        return;
      }

      if (error || !user) {
        setMessage("You must be logged in to view this admin page.");
        setUserEmail(null);
        setLoading(false);
        return;
      }

      setUserEmail(user.email?.toLowerCase() || null);
      setLoading(false);
    }

    checkAdminAccess();

    return () => {
      active = false;
    };
  }, []);

  const isAdmin = Boolean(userEmail && adminEmails.includes(userEmail));

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-950 px-6 py-10 text-white">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-3xl font-bold">Checking Admin Access</h1>
          <p className="mt-4 text-zinc-400">Please wait...</p>
        </div>
      </main>
    );
  }

  if (message) {
    return (
      <main className="min-h-screen bg-zinc-950 px-6 py-10 text-white">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-6 text-red-300">
            <h1 className="text-2xl font-bold">Admin Access Required</h1>
            <p className="mt-3">{message}</p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/login"
                className="rounded-lg bg-red-600 px-5 py-3 text-center font-semibold text-white hover:bg-red-700"
              >
                Login
              </Link>

              <Link
                href="/"
                className="rounded-lg border border-zinc-700 px-5 py-3 text-center font-semibold text-white hover:bg-zinc-800"
              >
                Back Home
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-zinc-950 px-6 py-10 text-white">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-6 text-red-300">
            <h1 className="text-2xl font-bold">Access Denied</h1>

            <p className="mt-3">
              Your account does not have permission to view admin pages.
            </p>

            <p className="mt-3 text-sm text-red-200/80">
              Logged in as: {userEmail || "Unknown user"}
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/"
                className="rounded-lg bg-red-600 px-5 py-3 text-center font-semibold text-white hover:bg-red-700"
              >
                Back Home
              </Link>

              <Link
                href="/tournaments"
                className="rounded-lg border border-zinc-700 px-5 py-3 text-center font-semibold text-white hover:bg-zinc-800"
              >
                Browse Tournaments
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}