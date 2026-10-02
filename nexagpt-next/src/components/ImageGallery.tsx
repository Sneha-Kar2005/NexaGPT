"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, X } from "lucide-react";
import type { ImageResult } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Grid of photo results (like ChatGPT's image search) with a full-screen viewer. */
export function ImageGallery({ images }: { images: ImageResult[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const single = images.length === 1;

  return (
    <>
      <div className={cn("mb-4 grid gap-2", single ? "grid-cols-1" : "grid-cols-2 sm:grid-cols-4")}>
        {images.map((img, i) => (
          <Thumb key={img.sourceUrl + i} image={img} single={single} onClick={() => setOpen(i)} />
        ))}
      </div>
      {open !== null && <Lightbox images={images} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
    </>
  );
}

function Thumb({ image, single, onClick }: { image: ImageResult; single: boolean; onClick: () => void }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  if (failed) return null;

  return (
    <button
      onClick={onClick}
      title={image.title}
      className={cn(
        "group relative overflow-hidden rounded-xl bg-elev",
        single ? "max-h-[420px] max-w-md" : "aspect-square",
      )}
    >
      {!loaded && <div className="absolute inset-0 animate-pulse bg-hover" />}
      <img
        src={image.thumbUrl}
        alt={image.title}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={cn(
          "size-full object-cover transition duration-300 group-hover:scale-105",
          loaded ? "opacity-100" : "opacity-0",
        )}
      />
      <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-2 pt-6 pb-1.5 text-left text-xs text-white opacity-0 transition group-hover:opacity-100">
        {image.title}
      </span>
    </button>
  );
}

function Lightbox({
  images,
  index,
  onIndex,
  onClose,
}: {
  images: ImageResult[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const img = images[index];
  const prev = useCallback(() => onIndex((index - 1 + images.length) % images.length), [index, images.length, onIndex]);
  const next = useCallback(() => onIndex((index + 1) % images.length), [index, images.length, onIndex]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose, prev, next]);

  const navButton = "absolute top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90 text-white" onClick={onClose} role="dialog" aria-modal="true">
      <div className="flex items-center justify-between gap-4 p-4" onClick={(e) => e.stopPropagation()}>
        <div className="min-w-0 text-sm">
          <p className="truncate font-medium">{img.title}</p>
          <p className="truncate text-xs text-white/60">
            {[img.author, img.license, "Wikimedia Commons"].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <a
            href={img.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm hover:bg-white/10"
          >
            <ExternalLink className="size-4" /> Source
          </a>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-2 hover:bg-white/10">
            <X className="size-5" />
          </button>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-6 md:px-16">
        <img
          key={img.fullUrl}
          src={img.fullUrl}
          alt={img.title}
          className="max-h-full max-w-full rounded-lg object-contain"
          onClick={(e) => e.stopPropagation()}
        />
        {images.length > 1 && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                prev();
              }}
              aria-label="Previous image"
              className={cn(navButton, "left-2 md:left-4")}
            >
              <ChevronLeft className="size-6" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                next();
              }}
              aria-label="Next image"
              className={cn(navButton, "right-2 md:right-4")}
            >
              <ChevronRight className="size-6" />
            </button>
            <p className="absolute bottom-1 left-1/2 -translate-x-1/2 text-xs text-white/60">
              {index + 1} / {images.length}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
