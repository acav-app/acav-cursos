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

export function uploadToR2WithProgress(file, folder, onProgress) {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.set("file", file);
    formData.set("folder", folder);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload", true);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && typeof onProgress === "function") {
        const percent = Math.min(100, Math.round((event.loaded / event.total) * 100));
        onProgress({ loaded: event.loaded, total: event.total, percent });
      }
    };

    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText || "{}");
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(data?.url);
        } else {
          reject(new Error(data?.error || "upload_failed"));
        }
      } catch (err) {
        reject(new Error("upload_failed_invalid_response"));
      }
    };

    xhr.onerror = () => reject(new Error("upload_network_error"));
    xhr.onabort = () => reject(new Error("upload_aborted"));

    xhr.send(formData);
  });
}
