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

function buildStreamUploadUrl({ folder, key, file }) {
  const params = new URLSearchParams();
  if (folder) params.set("folder", folder);
  if (key) params.set("key", key);
  params.set("fileName", file?.name || "");
  params.set("mimeType", file?.type || "application/octet-stream");
  params.set("size", String(file?.size || 0));
  return `/api/upload/stream?${params.toString()}`;
}

function multipartUploadPromise({ file, folder, key, onProgress }) {
  const total = Number(file?.size) || 0;
  return new Promise((resolve, reject) => {
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
}

function streamingUploadPromise({ file, folder, key, onProgress }) {
  const total = Number(file?.size) || 0;
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", buildStreamUploadUrl({ folder, key, file }), true);
    const contentType =
      file?.type && file.type !== "application/octet-stream"
        ? file.type
        : "application/octet-stream";
    xhr.setRequestHeader("Content-Type", contentType);

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
          reject(new Error(data?.error || "upload_stream_failed"));
        }
      } catch (err) {
        reject(new Error("upload_failed_invalid_response"));
      }
    };

    xhr.onerror = () => reject(new Error("upload_network_error"));
    xhr.onabort = () => reject(new Error("upload_aborted"));
    xhr.send(file);
  });
}

function presignedUploadPromise({ file, presigned, onProgress }) {
  const total = Number(file?.size) || 0;
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", presigned.uploadUrl, true);
    const contentType =
      (file?.type && file.type !== "application/octet-stream" ? file.type : presigned?.contentType) ||
      "application/octet-stream";
    if (contentType && contentType !== "application/octet-stream") {
      xhr.setRequestHeader("Content-Type", contentType);
    }
    xhr.setRequestHeader("X-Amz-Content-SHA256", "UNSIGNED-PAYLOAD");

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
              url: presigned.publicUrl,
              fileName: presigned.storageKey,
              storageKey: presigned.storageKey,
              size: Number(file?.size) || 0,
              type: file?.type || presigned.contentType || null,
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
  });
}

function shouldFallbackPresignedToStream(errMsg) {
  const msg = String(errMsg || "");
  if (!msg) return false;
  return (
    msg.includes("upload_network_error") ||
    msg.includes("upload_presigned_http_") ||
    msg.includes("cors") ||
    msg.toLowerCase().includes("blocked by CORS".toLowerCase())
  );
}

function shouldFallbackStreamToMultipart(errMsg) {
  const msg = String(errMsg || "");
  if (!msg) return false;
  return (
    msg.includes("r2_not_configured") ||
    msg.includes("413") ||
    msg.includes("Payload Too Large") ||
    msg.includes("stream_404") ||
    msg.includes("upload_stream_failed 5")
  );
}

export async function uploadToR2(file, folderOrOptions) {
  const hasFolder = typeof folderOrOptions === "string";
  const folder = hasFolder ? folderOrOptions : folderOrOptions?.folder;
  const key = hasFolder ? undefined : folderOrOptions?.key;
  const onProgress = () => {};
  const size = Number(file?.size) || 0;
  const safeForLegacyFallback = size > 0 && size <= 4 * 1024 * 1024;

  try {
    return await streamingUploadPromise({ file, folder, key, onProgress });
  } catch (err) {
    const msg = String(err?.message || err || "");
    if (!safeForLegacyFallback) {
      throw err;
    }
    if (!shouldFallbackStreamToMultipart(msg)) {
      try {
        const presigned = await fetchPresignedUploadOptions({ folder, key, file });
        return await presignedUploadPromise({ file, presigned, onProgress });
      } catch (presignedErr) {
        const pMsg = String(presignedErr?.message || presignedErr || "");
        if (!shouldFallbackPresignedToStream(pMsg) &&
            !pMsg.includes("presigned_404") &&
            !pMsg.includes("presigned_500") &&
            !pMsg.includes("r2_not_configured")) {
          throw presignedErr;
        }
      }
      throw err;
    }
  }

  return multipartUploadPromise({ file, folder, key, onProgress });
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
  const safeForLegacyFallback = total > 0 && total <= 4 * 1024 * 1024;
  if (typeof onProgress === "function") {
    onProgress({ loaded: 0, total, percent: 0, ratio: 0 });
  }

  return (async () => {
    try {
      return await streamingUploadPromise({ file, folder, key, onProgress });
    } catch (err) {
      const msg = String(err?.message || err || "");
      if (!safeForLegacyFallback) {
        throw err;
      }
      if (shouldFallbackStreamToMultipart(msg)) {
        return multipartUploadPromise({ file, folder, key, onProgress });
      }

      try {
        const presigned = await fetchPresignedUploadOptions({ folder, key, file });
        return await presignedUploadPromise({ file, presigned, onProgress });
      } catch (presignedErr) {
        const pMsg = String(presignedErr?.message || presignedErr || "");
        const presignedSoftFail =
          pMsg.includes("presigned_404") ||
          pMsg.includes("presigned_500") ||
          pMsg.includes("r2_not_configured") ||
          shouldFallbackPresignedToStream(pMsg);
        if (!presignedSoftFail) throw presignedErr;
      }

      return multipartUploadPromise({ file, folder, key, onProgress });
    }
  })();
}


