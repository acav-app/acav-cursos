"use client";
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { AlertTriangle, PlayCircle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import PlyrCssInline from "@/components/courses/vendor/plyr.css?raw";

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

let _PlyrConstructor;
let _cssInjected = false;

async function ensurePlyr() {
  if (typeof window === "undefined") return null;
  if (!_cssInjected && typeof document !== "undefined") {
    try {
      const style = document.createElement("style");
      style.setAttribute("data-plyr-css", "1");
      style.textContent = PlyrCssInline || "";
      document.head.appendChild(style);
    } catch {
      /* ignore */
    }
    _cssInjected = true;
  }
  if (_PlyrConstructor) return _PlyrConstructor;
  try {
    const m = await import(/* webpackChunkName: "plyr" */ "plyr");
    _PlyrConstructor = (m && m.default) ? m.default : (m ? m.Plyr || m : null);
    return _PlyrConstructor;
  } catch (err) {
    console.warn("VideoPlayer: no se pudo cargar Plyr.", err);
    return null;
  }
}

function normalizeKey(str) {
  return String(str || "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 48);
}

function guessVideoMime(url) {
  const u = String(url || "").toLowerCase();
  if (u.endsWith(".webm")) return "video/webm";
  if (u.endsWith(".mov") || u.endsWith(".m4v")) return "video/quicktime";
  if (u.endsWith(".mkv")) return "video/x-matroska";
  return "video/mp4";
}

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
  onError,
  className,
  fallbackLabel = "Video no disponible",
}) {
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const plyrStyleRef = useRef(null);
  const [posterVisible, setPosterVisible] = useState(Boolean(poster) && !autoPlay);
  const [plyrReady, setPlyrReady] = useState(false);
  const [playerError, setPlayerError] = useState(null);
  const [isBuffering, setIsBuffering] = useState(false);
  const [playbackState, setPlaybackState] = useState("idle"); // idle | playing | paused | ended
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [progressPercent, setProgressPercent] = useState(0);
  const [activeQuality, setActiveQuality] = useState(null);

  const PlyrCtorRef = useRef(null);

  const instanceKey = useMemo(() => {
    const srcHash = normalizeKey(src || "fallback-x");
    const kindHash = normalizeKey(kind || "file");
    return `plyr-${srcHash}-${kindHash}`;
  }, [src, kind]);

  const sources = useMemo(() => {
    if (Array.isArray(qualities) && qualities.length > 0) {
      return qualities.map((q) => ({
        src: q.url,
        type: mimeType || guessVideoMime(q.url),
        size: Number.isFinite(Number(q.height)) ? Number(q.height) : undefined,
        label: q.label || (q.height ? `${q.height}p` : undefined),
      }));
    }
    if (!src) return [];
    return [{ src, type: mimeType || guessVideoMime(src) }];
  }, [qualities, mimeType, src]);

  const tracks = useMemo(
    () =>
      (Array.isArray(subtitles) ? subtitles : []).map((s) => ({
        kind: s.kind || "captions",
        label: s.label || "Subtítulos",
        srclang: s.srclang || "es",
        src: s.src,
        default: Boolean(s.default),
      })),
    [subtitles]
  );

  const resetErrorState = useCallback(() => {
    setPlayerError(null);
  }, []);

  // Cleanup Plyr instance on unmount / before re-init.
  useEffect(() => {
    return () => {
      try {
        const inst = playerRef.current;
        if (inst && typeof inst.destroy === "function") {
          try {
            inst.pause?.();
          } catch {
            /* noop */
          }
          try {
            const plyrContainer = inst.elements?.container;
            const mount = containerRef.current;
            if (plyrContainer && mount && mount.contains(plyrContainer)) {
              inst.destroy();
            }
          } catch {
            /* destroy race */
          }
        }
      } catch {
        /* noop */
      }
      playerRef.current = null;
      PlyrCtorRef.current = null;
    };
  }, []);

  // Initialize Plyr asynchronously (only runtime, never SSR)
  useEffect(() => {
    let cancelled = false;
    let pendingDestroy = false;

    (async function initPlyrInstance() {
      try {
        if (!containerRef.current || !src) return;
        resetErrorState();
        const mount = containerRef.current;
        const vidId = instanceKey;

        const PlyrCtor = await ensurePlyr();
        if (cancelled || !mount || !document.body.contains(mount)) return;
        if (!PlyrCtor) {
          throw new Error("plyr_library_failed_to_load");
        }
        PlyrCtorRef.current = PlyrCtor;

        let videoEl = mount.querySelector(`video#${vidId}`);
        let iframeEl = mount.querySelector(`iframe#${vidId}`);
        if (!videoEl && kind !== "embed") return;
        if (!iframeEl && kind === "embed") return;

        // Clean previous instance if exists
        try {
          if (playerRef.current?.destroy) {
            try { playerRef.current.pause?.(); } catch {}
            const plyrContainer = playerRef.current.elements?.container;
            if (plyrContainer && mount.contains(plyrContainer)) {
              playerRef.current.destroy();
            }
          }
        } catch {}
        playerRef.current = null;

        let player;
        if (kind === "embed" && iframeEl) {
          player = new PlyrCtor(iframeEl, {
            controls: DEFAULT_CONTROLS,
            autoplay: Boolean(autoPlay),
            keyboard: { focused: true, global: true },
            tooltips: { controls: true, seek: true },
            ratio: "16:9",
            vimeo: { byline: false, portrait: false, title: false },
            youtube: { rel: 0, noCookie: true, showinfo: false },
            i18n: { restart: "Reiniciar", rewind: "Retroceder", play: "Reproducir", pause: "Pausa", fastForward: "Avanzar", seek: "Buscar", seekLabel: "{currentTime} de {duration}", played: "Reproducido", buffered: "Buffereado", currentTime: "Tiempo actual", duration: "Duración", volume: "Volumen", mute: "Silenciar", unmute: "Activar sonido", enableCaptions: "Activar subtítulos", disableCaptions: "Desactivar subtítulos", download: "Descargar", enterFullscreen: "Pantalla completa", exitFullscreen: "Salir de pantalla completa", frameTitle: "Reproductor de video", captions: "Subtítulos", settings: "Configuración", pip: "Imagen en imagen", menuBack: "Volver al menú", speed: "Velocidad", normal: "Normal", quality: "Calidad", loop: "Repetir", start: "Inicio" },
          });
        } else if (videoEl) {
          const qualityOpts = (sources || [])
            .map((s) => s.size)
            .filter((s) => Number.isFinite(s))
            .filter((v, i, arr) => arr.indexOf(v) === i);
          const defaultQuality =
            activeQuality ||
            (Array.isArray(qualityOpts) && qualityOpts.length
              ? qualityOpts[Math.min(Math.floor(qualityOpts.length / 2), qualityOpts.length - 1)]
              : undefined);

          player = new PlyrCtor(videoEl, {
            controls: DEFAULT_CONTROLS,
            autoplay: Boolean(autoPlay),
            keyboard: { focused: true, global: true },
            tooltips: { controls: true, seek: true },
            ratio: "16:9",
            quality: {
              default: defaultQuality,
              options: qualityOpts,
              forced: Boolean(qualityOpts && qualityOpts.length > 0),
              onChange: async (newQuality) => {
                try {
                  if (!sources || !sources.length) return;
                  const numeric = Number(newQuality);
                  const target = sources.find(
                    (s) =>
                      Number(s.size) === numeric ||
                      String(s.label) === String(newQuality) ||
                      String(s.size) === String(newQuality)
                  );
                  if (!target?.src || !target.src || !player) return;
                  if (String(videoEl?.currentSrc || videoEl?.src) === String(target.src)) return;
                  const wasPlaying = !videoEl.paused && !videoEl.ended;
                  const time = Number(videoEl.currentTime) || 0;
                  const prevVolume = Number(player.volume) ?? 1;
                  const prevMuted = Boolean(player.muted);
                  player.source = {
                    type: "video",
                    title: title || "video",
                    sources: [{ src: target.src, type: target.type, size: target.size }],
                    tracks,
                  };
                  const restore = () => {
                    try {
                      if (!player) return;
                      player.volume = prevVolume;
                      if (prevMuted) player.muted = true;
                      if (Number.isFinite(time) && time > 0.2) {
                        try {
                          player.currentTime = time;
                        } catch {}
                      }
                      if (wasPlaying) {
                        const tryPlay = async () => {
                          try {
                            const p = player.play?.();
                            if (p && typeof p.catch === "function") p.catch(() => {});
                          } catch {}
                        };
                        if (videoEl.readyState >= 2) tryPlay();
                        else {
                          const onCanPlay = () => {
                            tryPlay();
                            videoEl.removeEventListener("canplay", onCanPlay);
                          };
                          videoEl.addEventListener("canplay", onCanPlay, { once: true });
                        }
                      }
                    } catch {}
                  };
                  setActiveQuality(Number.isFinite(numeric) ? numeric : newQuality);
                  if (videoEl.readyState >= 2) restore();
                  else {
                    const onCanPlayAfter = () => {
                      restore();
                      videoEl.removeEventListener("canplay", onCanPlayAfter);
                    };
                    videoEl.addEventListener("canplay", onCanPlayAfter, { once: true });
                  }
                } catch (err) {
                  console.warn("Quality switch failed:", err);
                }
              },
            },
            speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] },
            captions: {
              active: tracks.some((t) => t.default),
              update: true,
              language: "auto",
            },
            storage: { enabled: true, key: "acav.cursos.plyr" },
            i18n: { restart: "Reiniciar", rewind: "Retroceder", play: "Reproducir", pause: "Pausa", fastForward: "Avanzar", seek: "Buscar", seekLabel: "{currentTime} de {duration}", played: "Reproducido", buffered: "Buffereado", currentTime: "Tiempo actual", duration: "Duración", volume: "Volumen", mute: "Silenciar", unmute: "Activar sonido", enableCaptions: "Activar subtítulos", disableCaptions: "Desactivar subtítulos", download: "Descargar", enterFullscreen: "Pantalla completa", exitFullscreen: "Salir de pantalla completa", frameTitle: "Reproductor de video", captions: "Subtítulos", settings: "Configuración", pip: "Imagen en imagen", menuBack: "Volver al menú", speed: "Velocidad", normal: "Normal", quality: "Calidad", loop: "Repetir", start: "Inicio" },
          });

          // Sync initial source + tracks when Plyr inits (in case React render added children after mount)
          try {
            if (sources && sources.length && (!videoEl.querySelectorAll("source").length || !videoEl.currentSrc)) {
              player.source = {
                type: "video",
                title: title || "video",
                sources,
                tracks,
              };
            }
          } catch {}

          // Error handlers
          const onErrorMedia = (evt) => {
            const code = videoEl.error?.code || 0;
            let msg = "error_loading_video";
            if (code === 1) msg = "video_aborted";
            else if (code === 2) msg = "video_network_error";
            else if (code === 3) msg = "video_decode_error";
            else if (code === 4) msg = "video_src_not_supported_or_not_found";
            setPlayerError({ code, message: msg, raw: evt });
            onError?.({ source: "video", code, message: msg });
          };
          const onErrorPlyr = (detail) => {
            const msg = detail?.message || "plyr_player_error";
            setPlayerError({ message: msg, raw: detail });
            onError?.({ source: "plyr", message: msg });
          };
          const onPlaying = () => { setPlaybackState("playing"); setIsBuffering(false); setPosterVisible(false); onPlay?.(); };
          const onPause = () => setPlaybackState("paused");
          const onEndedEv = () => { setPlaybackState("ended"); onEnded?.(); };
          const onWaiting = () => setIsBuffering(true);
          const onCanPlay = () => setIsBuffering(false);
          const onStalled = () => setIsBuffering(true);
          const onTimeUpdate = () => {
            const t = Number(videoEl?.currentTime) || 0;
            const d = Number(videoEl?.duration) || Number(player?.duration) || 0;
            setCurrentTime(t);
            if (d > 0) {
              setDuration(d);
              setProgressPercent(Math.min(100, Math.max(0, Math.round((t / d) * 100))));
            }
          };
          const onVolumeChange = () => {
            try {
              setMuted(Boolean(player?.muted));
              setVolume(Number(player?.volume) ?? 1);
            } catch {}
          };
          const onReadyInternal = () => {
            if (cancelled) return;
            setPlyrReady(true);
            // Initial volume sync
            try {
              setVolume(Number(player?.volume) ?? 1);
              setMuted(Boolean(player?.muted));
              if (sources?.length) {
                const currentSrc = String(videoEl.currentSrc || videoEl.src || "");
                const active = sources.find((s) => s.src === currentSrc);
                if (active?.size) setActiveQuality(active.size);
              }
            } catch {}
            onReady?.(player);
          };

          videoEl.addEventListener("error", onErrorMedia);
          if (kind !== "embed") {
            try { player.on("error", onErrorPlyr); } catch {}
            try { player.on("playing", onPlaying); } catch {}
            try { player.on("pause", onPause); } catch {}
            try { player.on("ended", onEndedEv); } catch {}
            try { player.on("waiting", onWaiting); } catch {}
            try { player.on("stalled", onStalled); } catch {}
            try { player.on("canplay", onCanPlay); } catch {}
            try { player.on("timeupdate", onTimeUpdate); } catch {}
            try { player.on("volumechange", onVolumeChange); } catch {}
            try { player.on("ready", onReadyInternal); } catch {}
            if (player.ready) setTimeout(onReadyInternal, 0);
          }
        }

        playerRef.current = player;

        if (kind === "embed") {
          try {
            const onReadyEmbed = () => {
              if (cancelled) return;
              setPlyrReady(true);
              onReady?.(player);
            };
            try { player.on("ready", onReadyEmbed); } catch {}
            try { player.on("playing", () => { setPlaybackState("playing"); setPosterVisible(false); onPlay?.(); }); } catch {}
            try { player.on("pause", () => setPlaybackState("paused")); } catch {}
            try { player.on("ended", () => { setPlaybackState("ended"); onEnded?.(); }); } catch {}
            try { player.on("error", (d) => { setPlayerError({ message: d?.message || "embed_error" }); onError?.({ source: "embed", message: d?.message || "embed_error" }); }); } catch {}
            if (player.ready) setTimeout(onReadyEmbed, 0);
          } catch {}
          if (autoPlay) {
            try {
              setTimeout(() => {
                const p = player.play?.();
                if (p && typeof p.catch === "function") p.catch(() => {});
              }, 350);
            } catch {}
          }
        }
      } catch (err) {
        console.warn("Plyr init failed:", err);
        setPlayerError({ message: err?.message || "plyr_init_failed" });
        onError?.({ source: "init", message: err?.message || "plyr_init_failed" });
      }
    })();

    return () => {
      cancelled = true;
      pendingDestroy = true;
      try {
        const inst = playerRef.current;
        if (inst?.destroy) {
          try { inst.pause?.(); } catch {}
          const mount = containerRef.current;
          const plyrContainer = inst.elements?.container;
          if (mount && plyrContainer && mount.contains(plyrContainer)) {
            try { inst.destroy(); } catch {}
          }
          playerRef.current = null;
        }
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instanceKey, src, kind, autoPlay]);

  // Playback controls (no race: ignore promise rejections from pause->play races)
  const togglePlay = useCallback(() => {
    try {
      const p = playerRef.current;
      if (!p) return;
      if (p.paused) {
        const pp = p.play?.();
        if (pp && typeof pp.catch === "function") pp.catch(() => {});
      } else {
        try { p.pause?.(); } catch {}
      }
    } catch {}
  }, []);

  const setVolumeLocal = useCallback((v) => {
    try {
      const p = playerRef.current;
      if (!p) return;
      const clamped = Math.min(1, Math.max(0, Number(v) || 0));
      p.volume = clamped;
      if (clamped > 0 && p.muted) p.muted = false;
      setVolume(clamped);
      setMuted(false);
    } catch {}
  }, []);

  const toggleMuteLocal = useCallback(() => {
    try {
      const p = playerRef.current;
      if (!p) return;
      p.muted = !p.muted;
      setMuted(Boolean(p.muted));
    } catch {}
  }, []);

  const seekTo = useCallback((seconds) => {
    try {
      const p = playerRef.current;
      if (!p) return;
      const t = Math.min(Math.max(0, Number(seconds) || 0), Number(p.duration) || Infinity);
      p.currentTime = t;
      setCurrentTime(t);
    } catch {}
  }, []);

  const handleStartFromPoster = useCallback(() => {
    if (!posterVisible) return;
    setPosterVisible(false);
    try {
      const p = playerRef.current;
      if (!p) return;
      const pp = p.play?.();
      if (pp && typeof pp.catch === "function") pp.catch(() => {});
    } catch {}
  }, [posterVisible]);

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

  return (
    <div
      key={instanceKey}
      ref={containerRef}
      className={cn(
        "group relative overflow-hidden rounded-[24px] border border-slate-200 bg-black shadow-[0_16px_50px_rgba(15,23,42,0.08)]",
        className
      )}
    >


      {playerError ? (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/80 p-6 text-center text-white">
          <Badge variant="soft" color="danger" className="mb-2 rounded-full bg-red-500/20 text-red-100 ring-1 ring-red-400/40">
            <AlertTriangle className="mr-1 h-3 w-3" /> Error al cargar el video
          </Badge>
          <p className="mb-2 text-sm text-slate-300">
            {playerError.message === "video_src_not_supported_or_not_found"
              ? "El video no se encuentra disponible o el formato no es compatible."
              : playerError.message === "video_network_error"
              ? "Ocurrió un error de red al intentar cargar el video."
              : playerError.message === "plyr_library_failed_to_load"
              ? "No se pudo inicializar el reproductor."
              : "No pudimos cargar el video en este momento."}
          </p>
          {typeof navigator !== "undefined" && typeof window !== "undefined" ? (
            <button
              type="button"
              onClick={() => {
                try { window.location.reload(); } catch {}
              }}
              className="rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-slate-900 shadow hover:bg-white"
            >
              Reintentar
            </button>
          ) : null}
        </div>
      ) : null}

      {isBuffering && !playerError ? (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
          <div className="flex items-center gap-2 rounded-full bg-black/55 px-4 py-2 text-xs font-medium text-white backdrop-blur">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando video…
          </div>
        </div>
      ) : null}

      {kind === "embed" ? (
        <iframe
          id={instanceKey}
          src={src}
          title={title || "video"}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
          allowFullScreen
          className="aspect-video h-full w-full"
          referrerPolicy="no-referrer-when-downgrade"
          loading="lazy"
        />
      ) : (
        <video
          id={instanceKey}
          playsInline
          webkit-playsinline="true"
          x5-playsinline="true"
          preload="metadata"
          controlsList="nodownload"
          className="aspect-video h-full w-full bg-black"
          onClick={togglePlay}
        >
          {sources.map((s, i) => (
            <source key={`${s.src}_${i}`} src={s.src} type={s.type} />
          ))}
          {tracks.map((s, i) => (
            <track
              key={`${s.srclang}_${i}`}
              kind={s.kind || "captions"}
              label={s.label}
              srcLang={s.srclang}
              src={s.src}
              default={s.default ? true : undefined}
            />
          ))}
        </video>
      )}

      {poster && posterVisible && !playerError ? (
        <button
          type="button"
          onClick={handleStartFromPoster}
          className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 text-center transition hover:backdrop-brightness-105 focus:outline-none focus:ring-4 focus:ring-white/40"
          style={{
            backgroundImage: `linear-gradient(180deg, rgba(15,23,42,0.15) 0%, rgba(15,23,42,0.35) 55%, rgba(15,23,42,0.65) 100%), url(${poster})`,
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            backgroundSize: "cover",
          }}
          aria-label={title ? `Reproducir ${title}` : "Reproducir video"}
        >
          <span className="pointer-events-none inline-flex h-20 w-20 items-center justify-center rounded-full bg-white/95 text-[#6D4CFF] shadow-[0_18px_50px_rgba(15,23,42,0.35)] ring-4 ring-white/30 transition group-hover:scale-105">
            <PlayCircle className="h-10 w-10" />
          </span>
          {title ? (
            <span className="pointer-events-none rounded-full bg-black/55 px-4 py-1.5 text-sm font-semibold text-white backdrop-blur max-w-[85%] truncate">
              {title}
            </span>
          ) : null}
        </button>
      ) : null}
    </div>
  );
}
