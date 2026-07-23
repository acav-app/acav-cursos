"use client";

import { useRef, useState } from "react";
import { Eye, ZoomIn, ZoomOut } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

export default function FlyerPreviewLightbox({ src, alt, title = "Programa del curso" }) {
  const [open, setOpen] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const scrollRef = useRef(null);
  const dragStateRef = useRef({ startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 });

  const handleOpenChange = (nextOpen) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setZoomed(false);
      setDragging(false);
      if (scrollRef.current) {
        scrollRef.current.scrollTop = 0;
        scrollRef.current.scrollLeft = 0;
      }
    }
  };

  const toggleZoom = () => {
    const nextZoomed = !zoomed;
    setZoomed(nextZoomed);
    setDragging(false);

    window.requestAnimationFrame(() => {
      if (!scrollRef.current) return;
      scrollRef.current.scrollTop = 0;
      scrollRef.current.scrollLeft = nextZoomed
        ? Math.max(0, (scrollRef.current.scrollWidth - scrollRef.current.clientWidth) / 2)
        : 0;
    });
  };

  const handlePointerDown = (event) => {
    if (!zoomed || !scrollRef.current) return;
    const container = scrollRef.current;
    setDragging(true);
    dragStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: container.scrollLeft,
      scrollTop: container.scrollTop,
    };
  };

  const handlePointerMove = (event) => {
    if (!dragging || !zoomed || !scrollRef.current) return;
    const container = scrollRef.current;
    const deltaX = event.clientX - dragStateRef.current.startX;
    const deltaY = event.clientY - dragStateRef.current.startY;
    container.scrollLeft = dragStateRef.current.scrollLeft - deltaX;
    container.scrollTop = dragStateRef.current.scrollTop - deltaY;
  };

  const handlePointerUp = () => {
    setDragging(false);
  };

  return (
    <>
      <div className="group relative overflow-hidden rounded-[18px] border border-slate-200 bg-slate-100">
        <img
          src={src}
          alt={alt}
          className="h-full max-h-[260px] w-full object-cover transition duration-300 group-hover:scale-[1.01]"
        />

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#1B2B50]/55 via-[#1B2B50]/10 to-transparent opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100" />

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="cursor-pointer absolute right-3 top-3 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/70 bg-white/92 text-[#1B2B50] shadow-[0_12px_30px_rgba(13,43,100,.18)] backdrop-blur-sm transition hover:scale-[1.03] hover:bg-white"
          aria-label="Ampliar flyer"
        >
          <Eye className="h-5 w-5" />
        </button>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
          <div className="rounded-full border border-white/20 bg-[#1B2B50]/72 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-white/90 backdrop-blur-sm">
            Vista previa
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          size="5xl"
          className="w-[96vw] max-w-[1100px] border border-white/10 bg-[#071631]/96 p-3 shadow-[0_24px_90px_rgba(2,8,23,.45)] sm:p-4"
          overlayClass="bg-[#020817]/78 backdrop-blur-md"
        >
          <DialogTitle className="sr-only">{title}</DialogTitle>
          <DialogDescription className="sr-only">Vista ampliada del programa del curso.</DialogDescription>

          <div className="flex items-center justify-between gap-3 px-1 pb-3 pt-1 text-white/88">
            <div className="rounded-full border border-white/12 bg-white/8 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] backdrop-blur-sm">
              Click en la imagen para ampliar
            </div>
            <button
              type="button"
              onClick={() => setZoomed((value) => !value)}
              className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-white/12"
              aria-label={zoomed ? "Alejar imagen" : "Acercar imagen"}
            >
              {zoomed ? <ZoomOut className="h-4 w-4" /> : <ZoomIn className="h-4 w-4" />}
              {zoomed ? "Alejar" : "Acercar"}
            </button>
          </div>

          <div
            ref={scrollRef}
            className={`max-h-[calc(92vh-92px)] overflow-auto rounded-[20px] border border-white/10 bg-[#0B1F44] ${zoomed ? (dragging ? "cursor-grabbing" : "cursor-grab") : ""}`}
            onMouseDown={handlePointerDown}
            onMouseMove={handlePointerMove}
            onMouseUp={handlePointerUp}
            onMouseLeave={handlePointerUp}
          >
            <div className="flex min-h-full min-w-full items-start justify-center bg-[radial-gradient(circle_at_top,_rgba(96,165,250,.22),_transparent_42%),linear-gradient(180deg,#0B1F44_0%,#071631_100%)]">
              <img
                src={src}
                alt={alt}
                onClick={toggleZoom}
                onDoubleClick={toggleZoom}
                draggable={false}
                className={`h-auto select-none object-contain transition-[width] duration-300 ease-out ${zoomed ? "w-[170%] max-w-none cursor-zoom-out" : "max-h-[82vh] w-full max-w-full cursor-zoom-in"}`}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
