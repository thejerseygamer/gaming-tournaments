import Link from "next/link";

const platformLinks = [
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
    href: "/my-tournaments",
    label: "My Tournaments",
  },
];

const accountLinks = [
  {
    href: "/profile",
    label: "Profile",
  },
  {
    href: "/account/security",
    label: "Account Security",
  },
  {
    href: "/notifications",
    label: "Notifications",
  },
  {
    href: "/login",
    label: "Login",
  },
  {
    href: "/signup",
    label: "Sign Up",
  },
];

const supportLinks = [
  {
    href: "/help",
    label: "How BattleGrid Works",
  },
  {
    href: "/support",
    label: "Support Center",
  },
  {
    href: "/forgot-password",
    label: "Forgot Password",
  },
  {
    href: "/resend-confirmation",
    label: "Resend Confirmation",
  },
];

const adminLinks = [
  {
    href: "/admin",
    label: "Admin Dashboard",
  },
  {
    href: "/admin/reports",
    label: "Reports",
  },
  {
    href: "/admin/tournaments",
    label: "Manage Tournaments",
  },
  {
    href: "/admin/reviews",
    label: "Score Reviews",
  },
  {
    href: "/admin/support",
    label: "Support Inbox",
  },
  {
    href: "/admin/announcements",
    label: "Announcements",
  },
];

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-gray-800 bg-black px-6 py-10 text-white">
      <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-5">
        <section>
          <Link href="/" className="mb-4 flex w-fit items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-red-700 bg-red-950/40 font-black text-red-300">
              BG
            </div>

            <div>
              <p className="text-xl font-black leading-none">BattleGrid</p>
              <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
                Gaming Tournaments
              </p>
            </div>
          </Link>

          <p className="max-w-sm text-sm leading-6 text-gray-400">
            Host tournaments, join brackets, submit scores, review results, and
            climb the leaderboard.
          </p>

          <p className="mt-6 text-xs text-gray-600">
            © {currentYear} BattleGrid. Built for competitive gamers.
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-sm font-black uppercase tracking-[0.25em] text-red-400">
            Platform
          </h2>

          <div className="grid gap-3">
            {platformLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-gray-400 hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-sm font-black uppercase tracking-[0.25em] text-red-400">
            Account
          </h2>

          <div className="grid gap-3">
            {accountLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-gray-400 hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-sm font-black uppercase tracking-[0.25em] text-red-400">
            Help
          </h2>

          <div className="grid gap-3">
            {supportLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-gray-400 hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-sm font-black uppercase tracking-[0.25em] text-red-400">
            Admin
          </h2>

          <div className="grid gap-3">
            {adminLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-gray-400 hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </footer>
  );
}