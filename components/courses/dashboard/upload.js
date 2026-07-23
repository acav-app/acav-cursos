"use client";

export async function uploadToR2(file, folder) {
  const formData = new FormData();
  formData.set("file", file);
  formData.set("folder", folder);

  const res = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.error || "upload_failed");
  }
  return data?.url;
}

