"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

function cleanNextPath(value: string | null) {
  if (!value) return "/my-tournaments";
  if (!value.startsWith("/")) return "/my-tournaments";
  if (value.startsWith("//")) return "/my-tournaments";

  return value;
}

export default function AuthCallbackPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState("Finishing authentication...");

  const handleAuthCallback = useCallback(async () => {
    setLoading(true);
    setSuccess(false);
    setMessage("Finishing authentication...");

    const currentUrl = new URL(window.location.href);
    const code = currentUrl.searchParams.get("code");
    const nextPath = cleanNextPath(currentUrl.searchParams.get("next"));

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        setMessage(`Authentication error: ${error.message}`);
        setSuccess(false);
        setLoading(false);
        return;
      }

      setSuccess(true);
      setMessage("Authentication complete. Redirecting...");
      setLoading(false);

      window.setTimeout(() => {
        router.push(nextPath);
        router.refresh();
      }, 900);

      return;
    }

    const { data, error } = await supabase.auth.getSession();

    if (error) {
      setMessage(`Session error: ${error.message}`);
      setSuccess(false);
      setLoading(false);
      return;
    }

    if (data.session) {
      setSuccess(true);
      setMessage("Session found. Redirecting...");
      setLoading(false);

      window.setTimeout(() => {
        router.push(nextPath);
        router.refresh();
      }, 900);

      return;
    }

    setMessage(
      "Authentication link is missing a code or has expired. Please try logging in again."
    );
    setSuccess(false);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void handleAuthCallback();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [handleAuthCallback]);

  return (
    <main className="min-h-screen bg-black p-6 text-white">
      <div className="mx-auto flex min-h-[70vh] max-w-4xl items-center justify-center">
        <section
          className={`w-full rounded-3xl border p-8 text-center ${
            success
              ? "border-green-800 bg-green-950/20"
              : "border-gray-800 bg-gray-950"
          }`}
        >
          {loading && (
            <div className="mx-auto mb-6 h-16 w-16 animate-spin rounded-full border-4 border-gray-800 border-t-red-600" />
          )}

          <p className="mb-4 text-sm font-black uppercase tracking-[0.3em] text-red-400">
            BattleGrid Auth
          </p>

          <h1 className="mb-4 text-4xl font-black">
            {success ? "Success" : loading ? "Please Wait" : "Auth Issue"}
          </h1>

          <p className="mx-auto mb-8 max-w-2xl text-gray-300">{message}</p>

          {!loading && !success && (
            <div className="flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/login"
                className="rounded-xl bg-white px-6 py-4 text-center font-black text-black hover:bg-gray-200"
              >
                Go to Login
              </Link>

              <Link
                href="/forgot-password"
                className="rounded-xl border border-gray-700 px-6 py-4 text-center font-black text-white hover:bg-gray-900"
              >
                Reset Password
              </Link>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}