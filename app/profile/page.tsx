"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type Profile = {
  id: string;
  gamer_tag: string | null;
  platform: string | null;
  favorite_team: string | null;
};

export default function ProfilePage() {
  const router = useRouter();

  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const [gamerTag, setGamerTag] = useState("");
  const [platform, setPlatform] = useState("");
  const [favoriteTeam, setFavoriteTeam] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (!isMounted) return;

      if (userError || !user) {
        router.push("/login");
        return;
      }

      setUserId(user.id);
      setEmail(user.email || "");

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (!isMounted) return;

      if (profileError) {
        setMessage(`Error loading profile: ${profileError.message}`);
        setLoading(false);
        return;
      }

      if (profileData) {
        const profile = profileData as Profile;

        setGamerTag(profile.gamer_tag || "");
        setPlatform(profile.platform || "");
        setFavoriteTeam(profile.favorite_team || "");
      }

      setLoading(false);
    }

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [router]);

  async function saveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!userId) {
      setMessage("You must be logged in to save your profile.");
      return;
    }

    setSaving(true);
    setMessage("");

    const { error } = await supabase.from("profiles").upsert({
      id: userId,
      gamer_tag: gamerTag.trim() || null,
      platform: platform.trim() || null,
      favorite_team: favoriteTeam.trim() || null,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      setMessage(`Error saving profile: ${error.message}`);
    } else {
      setMessage("Profile saved successfully.");
    }

    setSaving(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black p-6 text-white">
        <div className="mx-auto max-w-3xl">
          <p className="rounded-xl border border-gray-800 bg-gray-950 p-6 text-gray-400">
            Loading profile...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black p-6 text-white">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/tournaments"
          className="mb-6 inline-block text-sm text-gray-400 hover:text-white"
        >
          ← Back to Tournaments
        </Link>

        <section className="rounded-xl border border-gray-800 bg-gray-950 p-6">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="mb-2 text-4xl font-bold">My Profile</h1>
              <p className="text-gray-400">{email}</p>
            </div>

            <button
              onClick={signOut}
              className="rounded-lg border border-gray-700 px-5 py-3 font-bold text-white hover:bg-gray-900"
            >
              Sign Out
            </button>
          </div>

          <form onSubmit={saveProfile} className="grid gap-4">
            <div>
              <label className="mb-1 block text-sm text-gray-400">
                Gamer Tag
              </label>
              <input
                className="w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                placeholder="TheJerseyGamer"
                value={gamerTag}
                onChange={(e) => setGamerTag(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-gray-400">
                Platform
              </label>
              <input
                className="w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                placeholder="PS5 / Xbox / PC"
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-gray-400">
                Favorite Team
              </label>
              <input
                className="w-full rounded-lg border border-gray-700 bg-black px-4 py-3 text-white"
                placeholder="Eagles, Cowboys, Giants, Jets..."
                value={favoriteTeam}
                onChange={(e) => setFavoriteTeam(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-white px-5 py-3 font-bold text-black hover:bg-gray-200 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Profile"}
            </button>
          </form>

          {message && (
            <p className="mt-4 rounded-lg border border-gray-800 bg-black p-3 text-sm text-gray-300">
              {message}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}