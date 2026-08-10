"use client";

function buildResultPayload(data) {
  const d = data || {};
  return {
    url: d?.url || null,
    fileName: d?.fileName || d?.storageKey || null,
    storageKey: d?.storageKey || d?.fileName || null,
    size: typeof d?.size === "number" ? d.size : null,
    type: d?.type || null,
    etag: d?.etag || null,
  };
}

export async function uploadToR2(file, folderOrOptions) {
  const hasFolder = typeof folderOrOptions === "string";
  const folder = hasFolder ? folderOrOptions : folderOrOptions?.folder;
  const key = hasFolder ? undefined : folderOrOptions?.key;

  const formData = new FormData();
  formData.set("file", file);
  if (folder) formData.set("folder", folder);
  if (key) formData.set("key", key);

  const res = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.error || "upload_failed");
  }
  return buildResultPayload(data);
}

export function uploadToR2WithProgress(file, folderOrOptions, onProgress) {
  let folder = null;
  let key = null;
  if (typeof folderOrOptions === "string") {
    folder = folderOrOptions;
  } else {
    folder = folderOrOptions?.folder || null;
    key = folderOrOptions?.key || null;
  }
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.set("file", file);
    if (folder) formData.set("folder", folder);
    if (key) formData.set("key", key);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload", true);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && typeof onProgress === "function") {
        const ratio = Math.min(1, event.loaded / Math.max(1, event.total));
        const percentInt = Math.min(100, Math.round(ratio * 100));
        onProgress({
          loaded: event.loaded,
          total: event.total,
          percent: percentInt,
          ratio,
        });
      }
    };

    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText || "{}");
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(buildResultPayload(data));
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
