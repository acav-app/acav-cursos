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

async function fetchPresignedUploadOptions({ folder, key, file }) {
  const params = new URLSearchParams();
  if (folder) params.set("folder", folder);
  if (key) params.set("key", key);
  params.set("fileName", file?.name || "");
  params.set("mimeType", file?.type || "application/octet-stream");
  params.set("size", String(file?.size || 0));
  const res = await fetch(`/api/upload/presigned?${params.toString()}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.error || `presigned_${res.status}`);
  }
  return data;
}

export async function uploadToR2(file, folderOrOptions) {
  const hasFolder = typeof folderOrOptions === "string";
  const folder = hasFolder ? folderOrOptions : folderOrOptions?.folder;
  const key = hasFolder ? undefined : folderOrOptions?.key;

  try {
    const presigned = await fetchPresignedUploadOptions({ folder, key, file });
    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", presigned.uploadUrl, true);
      if (presigned.contentType) {
        xhr.setRequestHeader("Content-Type", presigned.contentType);
      }
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`upload_presigned_http_${xhr.status}`));
      };
      xhr.onerror = () => reject(new Error("upload_network_error"));
      xhr.onabort = () => reject(new Error("upload_aborted"));
      xhr.send(file);
    });
    return buildResultPayload({
      url: presigned.publicUrl,
      fileName: presigned.storageKey,
      storageKey: presigned.storageKey,
      size: Number(file?.size) || 0,
      type: file?.type || presigned.contentType || null,
      etag: null,
    });
  } catch (err) {
    const msg = String(err?.message || err || "");
    const shouldFallback =
      msg.includes("presigned_404") || msg.includes("presigned_500") || msg.includes("r2_not_configured");
    if (!shouldFallback) throw err;
  }

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

  const total = Number(file?.size) || 0;
  if (typeof onProgress === "function") {
    onProgress({ loaded: 0, total, percent: 0, ratio: 0 });
  }

  return (async () => {
    let mode = "presigned";
    let uploadUrl = null;
    let contentType = null;
    let publicUrl = null;
    let storageKey = null;

    try {
      const presigned = await fetchPresignedUploadOptions({ folder, key, file });
      uploadUrl = presigned.uploadUrl;
      contentType = presigned.contentType;
      publicUrl = presigned.publicUrl;
      storageKey = presigned.storageKey;
    } catch (err) {
      const msg = String(err?.message || err || "");
      const shouldFallback =
        msg.includes("presigned_404") ||
        msg.includes("presigned_500") ||
        msg.includes("r2_not_configured");
      if (!shouldFallback) throw err;
      mode = "multipart";
    }

    return new Promise((resolve, reject) => {
      if (mode === "presigned") {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl, true);
        if (contentType) xhr.setRequestHeader("Content-Type", contentType);

        xhr.upload.onprogress = (event) => {
          if (typeof onProgress !== "function") return;
          const loaded = Number(event.loaded) || 0;
          const resolvedTotal =
            event.lengthComputable && Number(event.total) > 0 ? Number(event.total) : total;
          const ratio = resolvedTotal > 0 ? Math.min(1, loaded / Math.max(1, resolvedTotal)) : 0;
          const percentInt = Math.min(100, Math.round(ratio * 100));
          onProgress({ loaded, total: resolvedTotal, percent: percentInt, ratio });
        };

        xhr.onload = () => {
          try {
            if (xhr.status >= 200 && xhr.status < 300) {
              if (typeof onProgress === "function") {
                const resolvedTotal = total || 0;
                onProgress({ loaded: resolvedTotal, total: resolvedTotal, percent: 100, ratio: 1 });
              }
              const etagRaw = xhr.getResponseHeader("ETag");
              const etag = etagRaw ? String(etagRaw).replace(/^"|"$/g, "") : null;
              resolve(
                buildResultPayload({
                  url: publicUrl,
                  fileName: storageKey,
                  storageKey,
                  size: Number(file?.size) || 0,
                  type: file?.type || contentType || null,
                  etag,
                })
              );
            } else {
              reject(new Error(`upload_presigned_http_${xhr.status}`));
            }
          } catch (err) {
            reject(new Error("upload_failed_invalid_response"));
          }
        };

        xhr.onerror = () => reject(new Error("upload_network_error"));
        xhr.onabort = () => reject(new Error("upload_aborted"));
        xhr.send(file);
        return;
      }

      const formData = new FormData();
      formData.set("file", file);
      if (folder) formData.set("folder", folder);
      if (key) formData.set("key", key);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/upload", true);

      xhr.upload.onprogress = (event) => {
        if (typeof onProgress !== "function") return;
        const loaded = Number(event.loaded) || 0;
        const resolvedTotal =
          event.lengthComputable && Number(event.total) > 0 ? Number(event.total) : total;
        const ratio = resolvedTotal > 0 ? Math.min(1, loaded / Math.max(1, resolvedTotal)) : 0;
        const percentInt = Math.min(100, Math.round(ratio * 100));
        onProgress({ loaded, total: resolvedTotal, percent: percentInt, ratio });
      };

      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText || "{}");
          if (xhr.status >= 200 && xhr.status < 300) {
            if (typeof onProgress === "function") {
              const resolvedTotal = Number(file?.size) || 0;
              onProgress({ loaded: resolvedTotal, total: resolvedTotal, percent: 100, ratio: 1 });
            }
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
  })();
}

