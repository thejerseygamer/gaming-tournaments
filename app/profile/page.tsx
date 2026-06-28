"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Profile = {
  id: string;
  gamer_tag: string | null;
  platform: string | null;
  favorite_team: string | null;
};

type ProfileForm = {
  gamerTag: string;
  platform: string;
  favoriteTeam: string;
};

const platformOptions = [
  "Xbox Series X|S",
  "PlayStation 5",
  "PC",
  "Xbox One",
  "PlayStation 4",
  "Nintendo Switch",
  "Mobile",
];

export default function ProfilePage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [form, setForm] = useState<ProfileForm>({
    gamerTag: "",
    platform: "",
    favoriteTeam: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (!active) {
        return;
      }

      if (userError || !user) {
        setNeedsLogin(true);
        setMessage("You must be logged in to edit your profile.");
        setLoading(false);
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, gamer_tag, platform, favorite_team")
        .eq("id", user.id)
        .maybeSingle();

      if (!active) {
        return;
      }

      if (profileError) {
        setMessage(profileError.message);
        setLoading(false);
        return;
      }

      const profile = profileData as Profile | null;

      setUserId(user.id);
      setEmail(user.email || "");
      setForm({
        gamerTag: profile?.gamer_tag || "",
        platform: profile?.platform || "",
        favoriteTeam: profile?.favorite_team || "",
      });
      setNeedsLogin(false);
      setLoading(false);
    }

    loadProfile();

    return () => {
      active = false;
    };
  }, []);

  function updateForm(field: keyof ProfileForm, value: string) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  }

  async function saveProfile() {
    if (!userId) {
      setMessage("You must be logged in to save your profile.");
      return;
    }

    if (!form.gamerTag.trim()) {
      setMessage("Enter your gamer tag before saving.");
      return;
    }

    if (!form.platform.trim()) {
      setMessage("Select your platform before saving.");
      return;
    }

    setSaving(true);
    setMessage("");

    const { error } = await supabase.from("profiles").upsert(
      {
        id: userId,
        gamer_tag: form.gamerTag.trim(),
        platform: form.platform.trim(),
        favorite_team: form.favoriteTeam.trim() || null,
      },
      {
        onConflict: "id",
      }
    );

    if (error) {
      setMessage(error.message);
      setSaving(false);
      return;
    }

    setMessage("Profile saved successfully.");
    setSaving(false);
  }

  async function signOut() {
    setMessage("");

    const { error } = await supabase.auth.signOut();

    if (error) {
      setMessage(error.message);
      return;
    }

    window.location.href = "/login";
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-950 px-6 py-10 text-white">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-3xl font-bold">Profile</h1>
          <p className="mt-4 text-zinc-400">Loading profile...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="mb-2 text-sm font-bold uppercase tracking-widest text-red-400">
              Player Profile
            </p>

            <h1 className="text-4xl font-bold">Profile</h1>

            <p className="mt-3 text-zinc-400">
              Set your gamer tag, platform, and favorite team so your name shows
              correctly in tournaments and brackets.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/tournaments"
              className="rounded-lg border border-zinc-700 px-4 py-2 text-center font-semibold text-white hover:bg-zinc-800"
            >
              Browse Tournaments
            </Link>

            <Link
              href="/my-tournaments"
              className="rounded-lg bg-red-600 px-4 py-2 text-center font-semibold text-white hover:bg-red-700"
            >
              My Tournaments
            </Link>
          </div>
        </div>

        {message && (
          <div className="mb-6 rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-red-300">
            {message}
          </div>
        )}

        {needsLogin && (
          <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center">
            <h2 className="text-2xl font-bold">Login Required</h2>

            <p className="mt-3 text-zinc-400">
              You need to log in before you can create or edit your player
              profile.
            </p>

            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/login"
                className="rounded-lg bg-red-600 px-5 py-3 font-semibold text-white hover:bg-red-700"
              >
                Login
              </Link>

              <Link
                href="/signup"
                className="rounded-lg border border-zinc-700 px-5 py-3 font-semibold text-white hover:bg-zinc-800"
              >
                Sign Up
              </Link>
            </div>
          </section>
        )}

        {!needsLogin && (
          <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
            <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <h2 className="text-2xl font-bold">Edit Player Info</h2>

              <div className="mt-6 space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-300">
                    Email
                  </label>

                  <input
                    value={email}
                    disabled
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-zinc-500 outline-none"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-300">
                    Gamer Tag
                  </label>

                  <input
                    value={form.gamerTag}
                    onChange={(event) =>
                      updateForm("gamerTag", event.target.value)
                    }
                    placeholder="Example: JerseyGamer"
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-300">
                    Platform
                  </label>

                  <select
                    value={form.platform}
                    onChange={(event) =>
                      updateForm("platform", event.target.value)
                    }
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-red-500"
                  >
                    <option value="">Select platform</option>

                    {platformOptions.map((platform) => (
                      <option key={platform} value={platform}>
                        {platform}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-300">
                    Favorite Team
                  </label>

                  <input
                    value={form.favoriteTeam}
                    onChange={(event) =>
                      updateForm("favoriteTeam", event.target.value)
                    }
                    placeholder="Example: Eagles, Cowboys, Chiefs"
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-red-500"
                  />
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    onClick={saveProfile}
                    disabled={saving}
                    className="rounded-lg bg-red-600 px-5 py-3 font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save Profile"}
                  </button>

                  <button
                    onClick={signOut}
                    className="rounded-lg border border-zinc-700 px-5 py-3 font-semibold text-white hover:bg-zinc-800"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            </section>

            <aside className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <h2 className="text-2xl font-bold">Profile Preview</h2>

              <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-950 p-5">
                <p className="text-sm font-bold uppercase tracking-widest text-red-400">
                  Gamer Tag
                </p>

                <p className="mt-2 text-3xl font-bold">
                  {form.gamerTag || "Not set"}
                </p>

                <div className="mt-6 space-y-4">
                  <div>
                    <p className="text-sm text-zinc-500">Platform</p>
                    <p className="mt-1 font-semibold">
                      {form.platform || "Not set"}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-zinc-500">Favorite Team</p>
                    <p className="mt-1 font-semibold">
                      {form.favoriteTeam || "Not set"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-100">
                Save your profile before joining tournaments so other players
                can see your gamer tag instead of “Unknown Player.”
              </div>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}