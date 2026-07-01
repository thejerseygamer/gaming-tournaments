"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
];

const ACCEPTED_IMAGE_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".heic",
  ".heif",
];

const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

type ImageUploadBoxProps = {
  onImageSelect?: (file: File | null) => void;
};

export default function ImageUploadBox({ onImageSelect }: ImageUploadBoxProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  function isAcceptedImage(file: File) {
    const fileName = file.name.toLowerCase();

    const hasValidMimeType = ACCEPTED_IMAGE_TYPES.includes(file.type);

    const hasValidExtension = ACCEPTED_IMAGE_EXTENSIONS.some((extension) =>
      fileName.endsWith(extension)
    );

    return hasValidMimeType || hasValidExtension;
  }

  function canPreviewImage(file: File) {
    const fileName = file.name.toLowerCase();

    return (
      file.type !== "image/heic" &&
      file.type !== "image/heif" &&
      !fileName.endsWith(".heic") &&
      !fileName.endsWith(".heif")
    );
  }

  function handleImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    setError("");
    setSelectedFile(null);

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl("");
    }

    if (!file) {
      onImageSelect?.(null);
      return;
    }

    if (!isAcceptedImage(file)) {
      setError(
        "Invalid screenshot type. Please upload JPG, JPEG, PNG, WEBP, GIF, HEIC, or HEIF."
      );
      event.target.value = "";
      onImageSelect?.(null);
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError(`Screenshot is too large. Max size is ${MAX_FILE_SIZE_MB}MB.`);
      event.target.value = "";
      onImageSelect?.(null);
      return;
    }

    setSelectedFile(file);
    onImageSelect?.(file);

    if (canPreviewImage(file)) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  }

  function clearImage() {
    setSelectedFile(null);
    setError("");

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl("");
    }

    if (inputRef.current) {
      inputRef.current.value = "";
    }

    onImageSelect?.(null);
  }

  return (
    <div className="w-full rounded-xl border border-neutral-700 bg-neutral-950 p-5 text-white">
      <label className="mb-2 block text-sm font-semibold">
        Upload Score Screenshot
      </label>

      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp,.gif,.heic,.heif,image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
        onChange={handleImageChange}
        className="block w-full cursor-pointer rounded-lg border border-neutral-700 bg-neutral-900 p-3 text-sm text-neutral-200 file:mr-4 file:rounded-md file:border-0 file:bg-red-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-red-700"
      />

      <p className="mt-2 text-xs text-neutral-400">
        Accepted score screenshot types: JPG, JPEG, PNG, WEBP, GIF, HEIC, HEIF.
      </p>

      {error && (
        <p className="mt-3 rounded-lg border border-red-500 bg-red-950 p-3 text-sm text-red-200">
          {error}
        </p>
      )}

      {selectedFile && (
        <div className="mt-4 rounded-lg border border-neutral-700 bg-neutral-900 p-4">
          <p className="text-sm font-semibold">Selected screenshot:</p>

          <p className="mt-1 break-all text-sm text-neutral-300">
            {selectedFile.name}
          </p>

          <p className="mt-1 text-xs text-neutral-500">
            {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
          </p>

          {previewUrl && (
            <div className="relative mt-4 h-80 w-full overflow-hidden rounded-lg border border-neutral-700 bg-black">
              <Image
                src={previewUrl}
                alt="Score screenshot preview"
                fill
                unoptimized
                className="object-contain"
              />
            </div>
          )}

          {!previewUrl && (
            <p className="mt-3 text-sm text-yellow-300">
              This screenshot type may not preview in the browser, but it can
              still be uploaded.
            </p>
          )}

          <button
            type="button"
            onClick={clearImage}
            className="mt-4 rounded-lg bg-neutral-800 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-700"
          >
            Remove Screenshot
          </button>
        </div>
      )}
    </div>
  );
}