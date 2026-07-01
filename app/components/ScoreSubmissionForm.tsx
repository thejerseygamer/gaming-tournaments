"use client";

import { useState } from "react";
import ImageUploadBox from "./ImageUploadBox";
import { supabase } from "../lib/supabase";

const BUCKET_NAME = "score-screenshots";

type ScoreSubmissionFormProps = {
  matchId: string;
  tournamentId?: string | null;
  player1Id?: string | null;
  player2Id?: string | null;
};

export default function ScoreSubmissionForm({
  matchId,
  tournamentId,
  player1Id,
  player2Id,
}: ScoreSubmissionFormProps) {
  const [player1Score, setPlayer1Score] = useState("");
  const [player2Score, setPlayer2Score] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function getFileExtension(fileName: string) {
    const parts = fileName.toLowerCase().split(".");
    const extension = parts.length > 1 ? parts[parts.length - 1] : "jpg";

    if (extension === "jpeg") {
      return "jpg";
    }

    return extension;
  }

  function isValidScore(value: string) {
    if (value.trim() === "") {
      return false;
    }

    const numberValue = Number(value);

    return Number.isInteger(numberValue) && numberValue >= 0;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSubmitting(true);
    setMessage("");
    setError("");

    try {
      if (!isValidScore(player1Score) || !isValidScore(player2Score)) {
        setError("Enter valid scores for both players.");
        setSubmitting(false);
        return;
      }

      if (!screenshot) {
        setError("Please upload a score screenshot.");
        setSubmitting(false);
        return;
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setError("You must be logged in to submit a score.");
        setSubmitting(false);
        return;
      }

      const fileExtension = getFileExtension(screenshot.name);

      const filePath = `${user.id}/${matchId}/${Date.now()}-${crypto.randomUUID()}.${fileExtension}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, screenshot, {
          cacheControl: "3600",
          upsert: false,
          contentType: screenshot.type || undefined,
        });

      if (uploadError) {
        setError(uploadError.message);
        setSubmitting(false);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(filePath);

      const { error: insertError } = await supabase
        .from("score_submissions")
        .insert({
          match_id: matchId,
          tournament_id: tournamentId ?? null,
          submitted_by: user.id,
          player1_id: player1Id ?? null,
          player2_id: player2Id ?? null,
          player1_score: Number(player1Score),
          player2_score: Number(player2Score),
          screenshot_url: publicUrlData.publicUrl,
          screenshot_path: filePath,
          status: "pending",
        });

      if (insertError) {
        await supabase.storage.from(BUCKET_NAME).remove([filePath]);
        setError(insertError.message);
        setSubmitting(false);
        return;
      }

      setPlayer1Score("");
      setPlayer2Score("");
      setScreenshot(null);
      setMessage("Score submitted. Waiting for admin approval.");
    } catch (submitError) {
      console.error(submitError);
      setError("Something went wrong while submitting the score.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-5 rounded-xl border border-neutral-800 bg-neutral-950 p-5"
    >
      <h3 className="text-lg font-bold text-white">Submit Score</h3>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-semibold text-neutral-300">
            Player 1 Score
          </label>

          <input
            type="number"
            min="0"
            value={player1Score}
            onChange={(event) => setPlayer1Score(event.target.value)}
            className="w-full rounded-lg border border-neutral-700 bg-neutral-900 p-3 text-white outline-none focus:border-red-500"
            placeholder="0"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-neutral-300">
            Player 2 Score
          </label>

          <input
            type="number"
            min="0"
            value={player2Score}
            onChange={(event) => setPlayer2Score(event.target.value)}
            className="w-full rounded-lg border border-neutral-700 bg-neutral-900 p-3 text-white outline-none focus:border-red-500"
            placeholder="0"
          />
        </div>
      </div>

      <div className="mt-5">
        <ImageUploadBox onImageSelect={setScreenshot} />
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-red-500 bg-red-950 p-3 text-sm text-red-200">
          {error}
        </p>
      )}

      {message && (
        <p className="mt-4 rounded-lg border border-green-500 bg-green-950 p-3 text-sm text-green-200">
          {message}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="mt-5 rounded-lg bg-red-600 px-5 py-3 font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Submitting..." : "Submit Score"}
      </button>
    </form>
  );
}