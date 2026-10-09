import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

const DEFAULT_PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Crect width='400' height='300' fill='%23f7f1e7'/%3E%3Cpath d='M160 110 L240 110 L240 190 L160 190 Z' stroke='%23c59b27' stroke-width='2' fill='none'/%3E%3Ccircle cx='200' cy='150' r='20' fill='%23c59b27' opacity='0.3'/%3E%3Ctext x='200' y='220' font-family='serif' font-size='14' fill='%23786f5f' text-anchor='middle'%3EĐiêu Khắc Xuân Trường%3C/text%3E%3C/svg%3E";

const MIN_ZOOM = 1;
const MAX_ZOOM = 5;
const DOUBLE_TAP_ZOOM = 2.5;
const RESET_VIEW = { scale: MIN_ZOOM, x: 0, y: 0 };

const clampScale = (value) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));

// Minimal photo viewer: pinch / wheel to zoom, drag to pan, tap outside or X to close.
export function ImageLightbox({
  images = [],
  activeIndex = 0,
  open = false,
  onClose,
  onSelect,
  title,
}) {
  const [view, setView] = useState(RESET_VIEW);
  const [isInteracting, setIsInteracting] = useState(false);

  const stageRef = useRef(null);
  const imageRef = useRef(null);
  const viewRef = useRef(view);
  const gestureRef = useRef({ type: null, lastTap: 0, moved: false });

  viewRef.current = view;

  const activeImage = useMemo(
    () => images[activeIndex] || images[0] || null,
    [activeIndex, images],
  );

  // Keep the image inside the stage when zoomed; centered at 1x.
  const clampView = (next) => {
    const stage = stageRef.current;
    const image = imageRef.current;
    if (!stage || !image || next.scale <= MIN_ZOOM + 0.01) return RESET_VIEW;
    const maxX = Math.max(0, (image.offsetWidth * next.scale - stage.clientWidth) / 2);
    const maxY = Math.max(0, (image.offsetHeight * next.scale - stage.clientHeight) / 2);
    return {
      scale: next.scale,
      x: Math.min(maxX, Math.max(-maxX, next.x)),
      y: Math.min(maxY, Math.max(-maxY, next.y)),
    };
  };

  // Zoom keeping the point under (clientX, clientY) fixed on screen.
  const zoomAt = (targetScale, clientX, clientY, base = viewRef.current) => {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const cx = clientX - rect.left - rect.width / 2;
    const cy = clientY - rect.top - rect.height / 2;
    const scale = clampScale(targetScale);
    const ratio = scale / base.scale;
    setView(clampView({ scale, x: cx - ratio * (cx - base.x), y: cy - ratio * (cy - base.y) }));
  };

  // Scroll lock + keyboard (Esc to close, arrows to switch photo)
  useEffect(() => {
    if (!open) return undefined;

    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
      if (images.length > 1 && event.key === "ArrowRight") onSelect?.((activeIndex + 1) % images.length);
      if (images.length > 1 && event.key === "ArrowLeft") onSelect?.((activeIndex - 1 + images.length) % images.length);
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeIndex, images.length, onClose, onSelect, open]);

  // Native non-passive listeners so wheel / touch never scroll the page behind.
  useEffect(() => {
    if (!open) return undefined;
    const stage = stageRef.current;
    if (!stage) return undefined;

    const handleWheel = (e) => {
      e.preventDefault();
      const current = viewRef.current;
      zoomAt(current.scale * Math.exp(-e.deltaY * 0.0018), e.clientX, e.clientY, current);
    };
    const handleTouchMove = (e) => {
      if (e.cancelable) e.preventDefault();
    };

    stage.addEventListener("wheel", handleWheel, { passive: false });
    stage.addEventListener("touchmove", handleTouchMove, { passive: false });
    return () => {
      stage.removeEventListener("wheel", handleWheel);
      stage.removeEventListener("touchmove", handleTouchMove);
    };
  }, [open, activeImage]);

  useEffect(() => {
    if (open) setView(RESET_VIEW);
  }, [activeIndex, open]);

  if (!open || !activeImage || typeof document === "undefined") {
    return null;
  }

  const toggleZoomAt = (clientX, clientY) => {
    if (viewRef.current.scale > MIN_ZOOM + 0.2) setView(RESET_VIEW);
    else zoomAt(DOUBLE_TAP_ZOOM, clientX, clientY);
  };

  // --- Touch: pinch to zoom, drag to pan, double tap, swipe to switch photo ---
  const getDistance = (touches) =>
    Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);

  const handleTouchStart = (e) => {
    const g = gestureRef.current;
    g.moved = false;
    g.lastTouchAt = Date.now();

    if (e.touches.length === 2) {
      g.type = "pinch";
      g.distance = getDistance(e.touches);
      g.base = viewRef.current;
      setIsInteracting(true);
      return;
    }

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const now = Date.now();
      if (now - g.lastTap < 300) {
        g.lastTap = 0;
        g.type = "doubletap";
        toggleZoomAt(touch.clientX, touch.clientY);
        return;
      }
      g.lastTap = now;
      g.type = "pan";
      g.startX = touch.clientX;
      g.startY = touch.clientY;
      g.base = viewRef.current;
      setIsInteracting(true);
    }
  };

  const handleTouchMove = (e) => {
    const g = gestureRef.current;

    if (g.type === "pinch" && e.touches.length === 2) {
      g.moved = true;
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      zoomAt(g.base.scale * (getDistance(e.touches) / (g.distance || 1)), midX, midY, g.base);
      return;
    }

    if (g.type === "pan" && e.touches.length === 1) {
      const dx = e.touches[0].clientX - g.startX;
      const dy = e.touches[0].clientY - g.startY;
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) g.moved = true;
      if (g.base.scale > MIN_ZOOM) {
        setView(clampView({ scale: g.base.scale, x: g.base.x + dx, y: g.base.y + dy }));
      }
    }
  };

  const handleTouchEnd = (e) => {
    const g = gestureRef.current;

    // At 1x a horizontal swipe switches photo.
    if (g.type === "pan" && g.base?.scale <= MIN_ZOOM && images.length > 1 && e.changedTouches?.length) {
      const dx = e.changedTouches[0].clientX - g.startX;
      if (dx < -50) onSelect?.((activeIndex + 1) % images.length);
      else if (dx > 50) onSelect?.((activeIndex - 1 + images.length) % images.length);
    }

    if (e.touches.length === 0) {
      g.type = null;
      setIsInteracting(false);
    }
  };

  // --- Mouse: drag to pan when zoomed, double click to toggle zoom ---
  const handleMouseDown = (e) => {
    const g = gestureRef.current;
    g.moved = false;
    if (e.button !== 0 || viewRef.current.scale <= MIN_ZOOM) return;
    g.type = "mouse";
    g.startX = e.clientX;
    g.startY = e.clientY;
    g.base = viewRef.current;
    setIsInteracting(true);
  };

  const handleMouseMove = (e) => {
    const g = gestureRef.current;
    if (g.type !== "mouse") return;
    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) g.moved = true;
    setView(clampView({ scale: g.base.scale, x: g.base.x + dx, y: g.base.y + dy }));
  };

  const handleMouseUp = () => {
    if (gestureRef.current.type === "mouse") gestureRef.current.type = null;
    setIsInteracting(false);
  };

  // Tap / click on the empty area around the photo closes the viewer.
  const handleStageClick = (e) => {
    if (gestureRef.current.moved) return;
    if (e.target !== imageRef.current) onClose?.();
  };

  const isZoomed = view.scale > MIN_ZOOM;

  return createPortal(
    <div className="photo-viewer" role="dialog" aria-modal="true" aria-label={title}>
      <div
        ref={stageRef}
        className="photo-viewer__stage"
        onClick={handleStageClick}
        onDoubleClick={(e) => {
          // Touch double tap is handled in handleTouchStart; ignore the emulated dblclick.
          if (Date.now() - (gestureRef.current.lastTouchAt || 0) < 800) return;
          if (e.target === imageRef.current) toggleZoomAt(e.clientX, e.clientY);
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        <img
          ref={imageRef}
          src={activeImage.url || DEFAULT_PLACEHOLDER}
          alt={activeImage.altText || title}
          style={{
            transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})`,
            transition: isInteracting ? "none" : "transform 0.2s ease-out",
            cursor: isZoomed ? (isInteracting ? "grabbing" : "grab") : "zoom-in",
          }}
          draggable={false}
          decoding="async"
          onError={(e) => {
            e.currentTarget.src = DEFAULT_PLACEHOLDER;
          }}
        />
      </div>

      {images.length > 1 ? (
        <span className="photo-viewer__counter">
          {activeIndex + 1}/{images.length}
        </span>
      ) : null}

      <button
        type="button"
        className="photo-viewer__close"
        onClick={onClose}
        aria-label="Đóng xem ảnh"
        title="Đóng (Esc)"
      >
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </div>,
    document.body,
  );
}
