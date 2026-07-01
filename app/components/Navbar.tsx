"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { checkIsAdmin } from "../lib/admin";

type NavLink = {
  href: string;
  label: string;
  adminOnly?: boolean;
  authOnly?: boolean;
};

const mainLinks: NavLink[] = [
  {
    href: "/",
    label: "Home",
  },
  {
    href: "/tournaments",
    label: "Tournaments",
  },
  {
    href: "/brackets",
    label: "Brackets",
  },
  {
    href: "/leaderboard",
    label: "Leaderboard",
  },
  {
    href: "/help",
    label: "Help",
  },
  {
    href: "/my-tournaments",
    label: "My Tournaments",
    authOnly: true,
  },
  {
    href: "/profile",
    label: "Profile",
    authOnly: true,
  },
  {
    href: "/account/security",
    label: "Security",
    authOnly: true,
  },
  {
    href: "/admin",
    label: "Admin",
    adminOnly: true,
  },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();

  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loadingUser, setLoadingUser] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  const isLoggedIn = Boolean(userEmail);

  const loadNavbar = useCallback(async () => {
    const adminCheck = await checkIsAdmin();

    const currentUserId = adminCheck.user?.id || "";
    const currentEmail = adminCheck.user?.email || "";

    setUserId(currentUserId);
    setUserEmail(currentEmail);
    setIsAdmin(Boolean(adminCheck.isAdmin));

    if (currentUserId) {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", currentUserId)
        .is("read_at", null);

      setUnreadCount(count || 0);
    } else {
      setUnreadCount(0);
    }

    setLoadingUser(false);
  }, []);

  const refreshUnreadCount = useCallback(async () => {
    if (!userId) {
      setUnreadCount(0);
      return;
    }

    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("read_at", null);

    setUnreadCount(count || 0);
  }, [userId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadNavbar();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadNavbar]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      window.setTimeout(() => {
        void loadNavbar();
      }, 0);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loadNavbar]);

  useEffect(() => {
    if (!userId) return;

    const intervalId = window.setInterval(() => {
      void refreshUnreadCount();
    }, 15000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [refreshUnreadCount, userId]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`navbar-notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void refreshUnreadCount();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refreshUnreadCount, userId]);

  const visibleLinks = useMemo(() => {
    return mainLinks.filter((link) => {
      if (link.adminOnly && !isAdmin) return false;
      if (link.authOnly && !isLoggedIn) return false;

      return true;
    });
  }, [isAdmin, isLoggedIn]);

  function closeMenu() {
    setMenuOpen(false);
  }

  function isActiveLink(href: string) {
    if (href === "/") {
      return pathname === "/";
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  }

  async function signOut() {
    setSigningOut(true);

    const { error } = await supabase.auth.signOut();

    if (error) {
      setSigningOut(false);
      return;
    }

    setUserId("");
    setUserEmail("");
    setIsAdmin(false);
    setUnreadCount(0);
    setMenuOpen(false);
    setSigningOut(false);

    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-50 border-b border-gray-800 bg-black/90 text-white backdrop-blur">
      <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
        <Link href="/" onClick={closeMenu} className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-red-700 bg-red-950/40 font-black text-red-300">
            BG
          </div>

          <div>
            <p className="text-lg font-black leading-none">BattleGrid</p>
            <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
              Tournaments
            </p>
          </div>
        </Link>

        <div className="hidden items-center gap-2 xl:flex">
          {visibleLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-lg px-3 py-2 text-sm font-bold ${
                isActiveLink(link.href)
                  ? "bg-red-950/50 text-red-300"
                  : "text-gray-300 hover:bg-gray-900 hover:text-white"
              }`}
            >
              {link.label}
            </Link>
          ))}

          {isLoggedIn && (
            <Link
              href="/notifications"
              className={`relative rounded-lg px-3 py-2 text-sm font-bold ${
                isActiveLink("/notifications")
                  ? "bg-red-950/50 text-red-300"
                  : "text-gray-300 hover:bg-gray-900 hover:text-white"
              }`}
            >
              Notifications

              {unreadCount > 0 && (
                <span className="ml-2 rounded-full bg-red-600 px-2 py-0.5 text-xs font-black text-white">
                  {unreadCount}
                </span>
              )}
            </Link>
          )}
        </div>

        <div className="hidden items-center gap-3 xl:flex">
          {loadingUser ? (
            <span className="text-sm text-gray-500">Loading...</span>
          ) : isLoggedIn ? (
            <>
              <span className="max-w-48 truncate text-sm text-gray-500">
                {userEmail}
              </span>

              <button
                type="button"
                onClick={signOut}
                disabled={signingOut}
                className="rounded-lg border border-gray-700 px-4 py-2 text-sm font-bold text-white hover:bg-gray-900 disabled:opacity-50"
              >
                {signingOut ? "Signing Out..." : "Sign Out"}
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                onClick={closeMenu}
                className="rounded-lg border border-gray-700 px-4 py-2 text-sm font-bold text-white hover:bg-gray-900"
              >
                Login
              </Link>

              <Link
                href="/signup"
                onClick={closeMenu}
                className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-black hover:bg-gray-200"
              >
                Sign Up
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((currentValue) => !currentValue)}
          className="rounded-lg border border-gray-700 px-4 py-2 text-sm font-bold text-white hover:bg-gray-900 xl:hidden"
        >
          {menuOpen ? "Close" : "Menu"}
        </button>
      </nav>

      {menuOpen && (
        <section className="border-t border-gray-800 bg-black px-6 py-4 xl:hidden">
          <div className="mx-auto grid max-w-7xl gap-2">
            {visibleLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={closeMenu}
                className={`rounded-lg px-3 py-3 text-sm font-bold ${
                  isActiveLink(link.href)
                    ? "bg-red-950/50 text-red-300"
                    : "text-gray-300 hover:bg-gray-900 hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            ))}

            {isLoggedIn && (
              <Link
                href="/notifications"
                onClick={closeMenu}
                className={`rounded-lg px-3 py-3 text-sm font-bold ${
                  isActiveLink("/notifications")
                    ? "bg-red-950/50 text-red-300"
                    : "text-gray-300 hover:bg-gray-900 hover:text-white"
                }`}
              >
                Notifications

                {unreadCount > 0 && (
                  <span className="ml-2 rounded-full bg-red-600 px-2 py-0.5 text-xs font-black text-white">
                    {unreadCount}
                  </span>
                )}
              </Link>
            )}

            <div className="mt-3 border-t border-gray-800 pt-3">
              {loadingUser ? (
                <p className="px-3 py-3 text-sm text-gray-500">Loading...</p>
              ) : isLoggedIn ? (
                <div className="grid gap-3">
                  <p className="truncate px-3 text-sm text-gray-500">
                    {userEmail}
                  </p>

                  <button
                    type="button"
                    onClick={signOut}
                    disabled={signingOut}
                    className="rounded-lg border border-gray-700 px-4 py-3 text-sm font-bold text-white hover:bg-gray-900 disabled:opacity-50"
                  >
                    {signingOut ? "Signing Out..." : "Sign Out"}
                  </button>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Link
                    href="/login"
                    onClick={closeMenu}
                    className="rounded-lg border border-gray-700 px-4 py-3 text-center text-sm font-bold text-white hover:bg-gray-900"
                  >
                    Login
                  </Link>

                  <Link
                    href="/signup"
                    onClick={closeMenu}
                    className="rounded-lg bg-white px-4 py-3 text-center text-sm font-bold text-black hover:bg-gray-200"
                  >
                    Sign Up
                  </Link>
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </header>
  );
}