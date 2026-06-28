"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "../lib/supabase";

type NavLink = {
  href: string;
  label: string;
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
    href: "/my-tournaments",
    label: "My Tournaments",
  },
  {
    href: "/brackets",
    label: "Brackets",
  },
  {
    href: "/profile",
    label: "Profile",
  },
];

const adminLinks: NavLink[] = [
  {
    href: "/admin",
    label: "Admin",
  },
  {
    href: "/admin/tournaments",
    label: "Manage Tournaments",
  },
  {
    href: "/admin/players",
    label: "Players",
  },
  {
    href: "/admin/reviews",
    label: "Reviews",
  },
];

export default function Navbar() {
  const pathname = usePathname();

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loadingUser, setLoadingUser] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active) {
        return;
      }

      setUserEmail(user?.email || null);
      setLoadingUser(false);
    }

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email || null);
      setLoadingUser(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  function isActive(href: string) {
    if (href === "/") {
      return pathname === "/";
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  }

  async function handleSignOut() {
    setSigningOut(true);

    const { error } = await supabase.auth.signOut();

    if (error) {
      setSigningOut(false);
      alert(error.message);
      return;
    }

    setUserEmail(null);
    setMobileOpen(false);
    window.location.href = "/login";
  }

  function linkClass(href: string) {
    return `rounded-lg px-3 py-2 text-sm font-semibold transition ${
      isActive(href)
        ? "bg-red-600 text-white"
        : "text-zinc-300 hover:bg-zinc-800 hover:text-white"
    }`;
  }

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 text-white">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-600 font-black">
            BG
          </div>

          <div>
            <p className="text-lg font-black leading-none">BattleGrid</p>
            <p className="text-xs text-zinc-500">Gaming Tournaments</p>
          </div>
        </Link>

        <div className="hidden items-center gap-2 lg:flex">
          {mainLinks.map((link) => (
            <Link key={link.href} href={link.href} className={linkClass(link.href)}>
              {link.label}
            </Link>
          ))}

          <div className="mx-2 h-6 w-px bg-zinc-800" />

          {adminLinks.map((link) => (
            <Link key={link.href} href={link.href} className={linkClass(link.href)}>
              {link.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-3 lg:flex">
          {loadingUser ? (
            <span className="text-sm text-zinc-500">Checking login...</span>
          ) : userEmail ? (
            <>
              <span className="max-w-48 truncate text-sm text-zinc-400">
                {userEmail}
              </span>

              <button
                onClick={handleSignOut}
                disabled={signingOut}
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {signingOut ? "Signing Out..." : "Sign Out"}
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
              >
                Login
              </Link>

              <Link
                href="/signup"
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                Sign Up
              </Link>
            </>
          )}
        </div>

        <button
          onClick={() => setMobileOpen((currentValue) => !currentValue)}
          className="rounded-lg border border-zinc-700 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-800 lg:hidden"
        >
          {mobileOpen ? "Close" : "Menu"}
        </button>
      </nav>

      {mobileOpen && (
        <div className="border-t border-zinc-800 bg-zinc-950 px-6 py-4 text-white lg:hidden">
          <div className="grid gap-2">
            {mainLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={linkClass(link.href)}
              >
                {link.label}
              </Link>
            ))}

            <div className="my-2 h-px bg-zinc-800" />

            {adminLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={linkClass(link.href)}
              >
                {link.label}
              </Link>
            ))}

            <div className="my-2 h-px bg-zinc-800" />

            {loadingUser ? (
              <p className="px-3 py-2 text-sm text-zinc-500">
                Checking login...
              </p>
            ) : userEmail ? (
              <div className="grid gap-2">
                <p className="truncate px-3 py-2 text-sm text-zinc-400">
                  {userEmail}
                </p>

                <button
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="rounded-lg border border-zinc-700 px-4 py-2 text-left text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {signingOut ? "Signing Out..." : "Sign Out"}
                </button>
              </div>
            ) : (
              <div className="grid gap-2">
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
                >
                  Login
                </Link>

                <Link
                  href="/signup"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
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