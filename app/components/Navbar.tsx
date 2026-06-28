"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { checkIsAdmin } from "../lib/admin";

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();

  const [userId, setUserId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [checkingUser, setCheckingUser] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  function linkClass(href: string) {
    const isActive =
      href === "/" ? pathname === "/" : pathname.startsWith(href);

    return `rounded-lg px-3 py-2 text-sm font-bold transition ${
      isActive
        ? "bg-white text-black"
        : "text-gray-300 hover:bg-gray-900 hover:text-white"
    }`;
  }

  async function loadUserState() {
    setCheckingUser(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setUserId("");
      setIsAdmin(false);
      setCheckingUser(false);
      return;
    }

    setUserId(user.id);

    const adminCheck = await checkIsAdmin();

    setIsAdmin(Boolean(adminCheck.isAdmin));
    setCheckingUser(false);
  }

  useEffect(() => {
    let isMounted = true;

    async function loadInitialUser() {
      if (!isMounted) return;

      await loadUserState();
    }

    loadInitialUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async () => {
      await loadUserState();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    setSigningOut(true);

    await supabase.auth.signOut();

    setUserId("");
    setIsAdmin(false);
    setMenuOpen(false);
    setSigningOut(false);

    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-50 border-b border-gray-800 bg-black/95 text-white backdrop-blur">
      <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="rounded-lg bg-red-600 px-3 py-2 text-lg font-black text-white">
            BG
          </span>

          <span className="text-xl font-black tracking-tight">
            BattleGrid
          </span>
        </Link>

        <button
          type="button"
          onClick={() => setMenuOpen((current) => !current)}
          className="rounded-lg border border-gray-700 px-3 py-2 text-sm font-bold text-white md:hidden"
        >
          {menuOpen ? "Close" : "Menu"}
        </button>

        <div className="hidden items-center gap-2 md:flex">
          <Link href="/" className={linkClass("/")}>
            Home
          </Link>

          <Link href="/tournaments" className={linkClass("/tournaments")}>
            Tournaments
          </Link>

          {userId && (
            <Link
              href="/my-tournaments"
              className={linkClass("/my-tournaments")}
            >
              My Tournaments
            </Link>
          )}

          <Link href="/brackets" className={linkClass("/brackets")}>
            Brackets
          </Link>

          {userId && (
            <Link href="/profile" className={linkClass("/profile")}>
              Profile
            </Link>
          )}

          {isAdmin && (
            <>
              <Link href="/admin" className={linkClass("/admin")}>
                Admin
              </Link>

              <Link
                href="/admin/reviews"
                className={linkClass("/admin/reviews")}
              >
                Score Reviews
              </Link>

              <Link
                href="/admin/tournaments"
                className={linkClass("/admin/tournaments")}
              >
                Brackets
              </Link>

              <Link
                href="/admin/players"
                className={linkClass("/admin/players")}
              >
                Players
              </Link>
            </>
          )}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          {checkingUser ? (
            <span className="text-sm text-gray-500">Checking...</span>
          ) : userId ? (
            <button
              type="button"
              onClick={signOut}
              disabled={signingOut}
              className="rounded-lg border border-red-800 px-4 py-2 text-sm font-bold text-red-300 hover:bg-red-950/40 disabled:opacity-50"
            >
              {signingOut ? "Signing out..." : "Sign Out"}
            </button>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-lg border border-gray-700 px-4 py-2 text-sm font-bold text-white hover:bg-gray-900"
              >
                Login
              </Link>

              <Link
                href="/signup"
                className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-black hover:bg-gray-200"
              >
                Sign Up
              </Link>
            </>
          )}
        </div>
      </nav>

      {menuOpen && (
        <div className="border-t border-gray-800 px-6 py-4 md:hidden">
          <div className="grid gap-2">
            <Link
              href="/"
              onClick={() => setMenuOpen(false)}
              className={linkClass("/")}
            >
              Home
            </Link>

            <Link
              href="/tournaments"
              onClick={() => setMenuOpen(false)}
              className={linkClass("/tournaments")}
            >
              Tournaments
            </Link>

            {userId && (
              <Link
                href="/my-tournaments"
                onClick={() => setMenuOpen(false)}
                className={linkClass("/my-tournaments")}
              >
                My Tournaments
              </Link>
            )}

            <Link
              href="/brackets"
              onClick={() => setMenuOpen(false)}
              className={linkClass("/brackets")}
            >
              Brackets
            </Link>

            {userId && (
              <Link
                href="/profile"
                onClick={() => setMenuOpen(false)}
                className={linkClass("/profile")}
              >
                Profile
              </Link>
            )}

            {isAdmin && (
              <>
                <div className="my-2 border-t border-gray-800" />

                <p className="px-3 text-xs font-bold uppercase tracking-[0.25em] text-red-500">
                  Admin
                </p>

                <Link
                  href="/admin"
                  onClick={() => setMenuOpen(false)}
                  className={linkClass("/admin")}
                >
                  Admin Dashboard
                </Link>

                <Link
                  href="/admin/reviews"
                  onClick={() => setMenuOpen(false)}
                  className={linkClass("/admin/reviews")}
                >
                  Score Reviews
                </Link>

                <Link
                  href="/admin/tournaments"
                  onClick={() => setMenuOpen(false)}
                  className={linkClass("/admin/tournaments")}
                >
                  Manage Brackets
                </Link>

                <Link
                  href="/admin/players"
                  onClick={() => setMenuOpen(false)}
                  className={linkClass("/admin/players")}
                >
                  Manage Players
                </Link>
              </>
            )}

            <div className="my-2 border-t border-gray-800" />

            {checkingUser ? (
              <span className="px-3 py-2 text-sm text-gray-500">
                Checking...
              </span>
            ) : userId ? (
              <button
                type="button"
                onClick={signOut}
                disabled={signingOut}
                className="rounded-lg border border-red-800 px-4 py-3 text-left text-sm font-bold text-red-300 hover:bg-red-950/40 disabled:opacity-50"
              >
                {signingOut ? "Signing out..." : "Sign Out"}
              </button>
            ) : (
              <div className="grid gap-2">
                <Link
                  href="/login"
                  onClick={() => setMenuOpen(false)}
                  className="rounded-lg border border-gray-700 px-4 py-3 text-sm font-bold text-white hover:bg-gray-900"
                >
                  Login
                </Link>

                <Link
                  href="/signup"
                  onClick={() => setMenuOpen(false)}
                  className="rounded-lg bg-white px-4 py-3 text-sm font-bold text-black hover:bg-gray-200"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}