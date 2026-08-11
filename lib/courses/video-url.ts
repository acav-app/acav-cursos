export function isVideoEmbedUrl(url: unknown): boolean {
  const raw = String(url || "").trim();
  if (!raw) return false;
  try {
    const u = new URL(raw);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    const path = u.pathname || "";
    if (host === "youtube-nocookie.com" || host === "m.youtube-nocookie.com") return true;
    if (host === "player.vimeo.com") return true;
    if (host === "vimeo.com" && /^\/video\/\d+/i.test(path)) return true;
    if ((host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") && /^\/embed\//i.test(path)) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function isYoutubeUrl(url: unknown): boolean {
  const raw = String(url || "").trim();
  if (!raw) return false;
  try {
    const u = new URL(raw);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    return (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "youtu.be" ||
      host === "youtube-nocookie.com" ||
      host === "m.youtube-nocookie.com"
    );
  } catch {
    return /^https?:\/\/(www\.|m\.)?youtu(\.be|be\.com)\//i.test(raw);
  }
}

export function isVimeoUrl(url: unknown): boolean {
  const raw = String(url || "").trim();
  if (!raw) return false;
  try {
    const u = new URL(raw);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    return host === "vimeo.com" || host === "player.vimeo.com";
  } catch {
    return /^https?:\/\/(www\.)?vimeo\.com\//i.test(raw);
  }
}

export function toEmbedUrl(url: unknown): string {
  const raw = String(url || "").trim();
  if (!raw) return "";
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return raw;
  }
  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  const path = (parsed.pathname || "").replace(/\/+$/, "");
  const params = new URLSearchParams(parsed.search || "");

  const copyParams = new Set<string>([
    "t",
    "start",
    "end",
    "list",
    "controls",
    "autoplay",
    "muted",
    "loop",
    "playsinline",
    "rel",
    "hl",
    "fs",
    "modestbranding",
    "color",
    "title",
    "byline",
    "portrait",
  ]);
  const keepParams = new URLSearchParams();
  const paramEntries: Array<[string, string]> = [];
  params.forEach((value, key) => {
    paramEntries.push([String(key), String(value)]);
  });
  for (let i = 0; i < paramEntries.length; i++) {
    const [key, value] = paramEntries[i];
    if (copyParams.has(String(key).toLowerCase())) {
      keepParams.set(key, value);
    }
  }

  const ytTime = keepParams.get("start") || keepParams.get("t");
  if (!keepParams.has("start") && ytTime) {
    keepParams.set("start", ytTime);
  }
  if (!keepParams.has("autoplay")) keepParams.set("autoplay", "0");
  if (!keepParams.has("rel")) keepParams.set("rel", "0");

  if (host === "youtu.be") {
    const id = String(path.replace(/^\//, "") || "").trim();
    if (id) {
      keepParams.delete("t");
      keepParams.delete("start");
      const qs = keepParams.toString();
      return `https://www.youtube.com/embed/${id}${qs ? `?${qs}` : ""}`;
    }
    return raw;
  }

  if (host === "youtube.com" || host === "m.youtube.com") {
    if (/^\/embed\/([^/?#]+)/i.test(path)) {
      return raw;
    }
    const v = params.get("v");
    if (v) {
      keepParams.delete("v");
      keepParams.delete("t");
      const qs = keepParams.toString();
      return `https://www.youtube.com/embed/${String(v)}${qs ? `?${qs}` : ""}`;
    }
    const shortsMatch = path.match(/^\/shorts\/([^/?#]+)/i);
    if (shortsMatch && shortsMatch[1]) {
      const qs = keepParams.toString();
      return `https://www.youtube.com/embed/${shortsMatch[1]}${qs ? `?${qs}` : ""}`;
    }
    const liveMatch = path.match(/^\/live\/([^/?#]+)/i);
    if (liveMatch && liveMatch[1]) {
      const qs = keepParams.toString();
      return `https://www.youtube.com/embed/${liveMatch[1]}${qs ? `?${qs}` : ""}`;
    }
    const vMatch = path.match(/^\/v\/([^/?#]+)/i);
    if (vMatch && vMatch[1]) {
      const qs = keepParams.toString();
      return `https://www.youtube.com/embed/${vMatch[1]}${qs ? `?${qs}` : ""}`;
    }
    return raw;
  }

  if (host === "youtube-nocookie.com" || host === "m.youtube-nocookie.com") {
    if (/^\/embed\/([^/?#]+)/i.test(path)) return raw;
    return raw;
  }

  if (host === "vimeo.com" || host === "player.vimeo.com") {
    if (host === "player.vimeo.com" && /^\/video\/\d+/i.test(path)) {
      return raw;
    }
    const idMatch = path.match(/^\/(\d+)(?:\/.*)?$/);
    if (idMatch && idMatch[1]) {
      const qs = keepParams.toString();
      return `https://player.vimeo.com/video/${idMatch[1]}${qs ? `?${qs}` : ""}`;
    }
    return raw;
  }

  return raw;
}
