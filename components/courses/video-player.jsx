"use client";
import React, { useEffect, useRef } from "react";
import Plyr from "plyr";
import "plyr/dist/plyr.css";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const DEFAULT_CONTROLS = [
  "play-large",
  "play",
  "progress",
  "current-time",
  "duration",
  "mute",
  "volume",
  "captions",
  "settings",
  "pip",
  "airplay",
  "fullscreen",
];

export default function VideoPlayer({
  src,
  poster,
  title,
  kind = "file",
  qualities = [],
  subtitles = [],
  mimeType,
  autoPlay = false,
  onReady,
  onPlay,
  onEnded,
  className,
  fallbackLabel = "Video no disponible",
}) {
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const videoIdRef = useRef(`plyr_${Math.random().toString(36).slice(2, 10)}`);

  useEffect(() => {
    if (!containerRef.current || !src) return undefined;
    const mount = containerRef.current;
    const vidId = videoIdRef.current;

    let videoEl = mount.querySelector(`video#${vidId}`);
    let iframeEl = mount.querySelector(`iframe#${vidId}`);

    const clean = () => {
      try {
        if (playerRef.current?.destroy) playerRef.current.destroy();
      } catch {
        /* noop */
      }
      playerRef.current = null;
    };

    try {
      if (kind === "embed" && iframeEl) {
        playerRef.current = new Plyr(iframeEl, {
          controls: DEFAULT_CONTROLS,
          autoplay: autoPlay,
          keyboard: { focused: true, global: true },
          tooltips: { controls: true, seek: true },
          ratio: "16:9",
        });
      } else if (videoEl) {
        playerRef.current = new Plyr(videoEl, {
          controls: DEFAULT_CONTROLS,
          autoplay: autoPlay,
          keyboard: { focused: true, global: true },
          tooltips: { controls: true, seek: true },
          ratio: "16:9",
          quality: {
            default: qualities?.length ? qualities[Math.floor(qualities.length / 2)]?.label : undefined,
            options: qualities?.map((q) => q.height || 1080) || [],
            forced: true,
            onChange: (newQuality) => {
              const target = qualities?.find((q) => String(q.height || q.label) === String(newQuality));
              if (target?.url && videoEl && videoEl.src !== target.url) {
                const wasPlaying = !videoEl.paused;
                const currentTime = videoEl.currentTime;
                videoEl.src = target.url;
                videoEl.load();
                if (wasPlaying) {
                  videoEl
                    .play()
                    .then(() => {
                      videoEl.currentTime = currentTime;
                    })
                    .catch(() => {});
                }
              }
            },
          },
          speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] },
          captions: { active: subtitles?.some((s) => s.default), update: true, language: "auto" },
          storage: { enabled: true, key: "acav.cursos.plyr" },
          vimeo: { byline: false, portrait: false, title: false },
          youtube: { rel: 0, noCookie: true, showinfo: false },
        });
        if (onReady) {
          playerRef.current.on("ready", () => onReady?.(playerRef.current));
        }
        if (onPlay) playerRef.current.on("play", () => onPlay?.());
        if (onEnded) playerRef.current.on("ended", () => onEnded?.());
      }
    } catch (err) {
      console.warn("Plyr init failed:", err);
    }

    return clean;
  }, [src, kind, subtitles, qualities, autoPlay, onReady, onPlay, onEnded]);

  if (!src) {
    return (
      <div
        className={cn(
          "relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-100",
          className
        )}
      >
        <div className="flex flex-col items-center gap-2 px-4 text-center">
          <Badge variant="soft" color="warning" className="rounded-full">
            <AlertTriangle className="mr-1 h-3 w-3" /> Sin video disponible
          </Badge>
          <p className="text-sm text-slate-500">{fallbackLabel}</p>
        </div>
      </div>
    );
  }

  const sources = qualities?.length
    ? qualities.map((q) => ({
        src: q.url,
        type: mimeType || "video/mp4",
        size: q.height || undefined,
      }))
    : [{ src, type: mimeType || guessVideoMime(src) }];

  return (
    <div
      ref={containerRef}
      className={cn(
        "group relative overflow-hidden rounded-[24px] border border-slate-200 bg-black/5 shadow-[0_16px_50px_rgba(15,23,42,0.08)]",
        className
      )}
    >
      {title ? (
        <div className="absolute left-3 top-3 z-10 rounded-full bg-black/60 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur">
          {title}
        </div>
      ) : null}
      {kind === "embed" ? (
        <iframe
          id={videoIdRef.current}
          src={src}
          title={title || "video"}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="aspect-video h-full w-full"
        />
      ) : (
        <video
          id={videoIdRef.current}
          playsInline
          poster={poster || undefined}
          preload="metadata"
          className="aspect-video h-full w-full"
        >
          {sources.map((s, i) => (
            <source key={`${s.src}_${i}`} src={s.src} type={s.type} />
          ))}
          {(subtitles || []).map((s, i) => (
            <track
              key={`${s.srclang}_${i}`}
              kind="captions"
              label={s.label}
              srcLang={s.srclang}
              src={s.src}
              default={s.default ? true : undefined}
            />
          ))}
        </video>
      )}
    </div>
  );
}

function guessVideoMime(url) {
  const u = String(url || "").toLowerCase();
  if (u.endsWith(".webm")) return "video/webm";
  if (u.endsWith(".mov") || u.endsWith(".m4v")) return "video/quicktime";
  return "video/mp4";
}
