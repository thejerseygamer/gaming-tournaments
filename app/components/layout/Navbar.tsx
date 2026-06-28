import Link from "next/link";
import { siteConfig } from "../../lib/siteConfig";

export default function Navbar() {
  return (
    <nav className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="text-2xl font-bold text-blue-500">
          {siteConfig.name}
        </Link>

        <div className="hidden gap-8 md:flex text-zinc-300">
          <Link href="/tournaments">Tournaments</Link>
          <Link href="/leaderboards">Leaderboards</Link>
          <Link href="/about">About</Link>
        </div>

        <button className="rounded-lg bg-blue-600 px-5 py-2 hover:bg-blue-500">
          Login
        </button>
      </div>
    </nav>
  );
}