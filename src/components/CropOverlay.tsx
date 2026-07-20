import { useEffect, useRef, useState } from "react";

interface Props {
  source: File | string;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void;
  onChooseAnother?: () => void;
  onSkip?: () => void;
}

const FRAME = 280;

export function CropOverlay({ source, onCancel, onConfirm, onChooseAnother, onSkip }: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const [fitScale, setFitScale] = useState(1);
  const drag = useRef<{
    x: number; y: number; tx: number; ty: number;
    pinchD?: number; pinchScale?: number;
  } | null>(null);

  const clampTranslate = (sc: number, x: number, y: number, size = imgSize) => {
    const maxX = Math.max(0, (size.w * sc - FRAME) / 2);
    const maxY = Math.max(0, (size.h * sc - FRAME) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
    };
  };

  const setScaleClamped = (next: number) => {
    const clamped = Math.max(fitScale, Math.min(8, next));
    setScale(clamped);
    const c = clampTranslate(clamped, tx, ty);
    setTx(c.x); setTy(c.y);
  };

  useEffect(() => {
    const url = typeof source === "string" ? source : URL.createObjectURL(source);
    setSrc(url);
    const img = new Image();
    img.onload = () => {
      // Use "contain" fit so the entire image is visible at min zoom; user can pinch in to crop.
      const fit = Math.min(FRAME / img.width, FRAME / img.height);
      setImgSize({ w: img.width, h: img.height });
      setFitScale(fit);
      setScale(fit);
      setTx(0); setTy(0);
    };
    img.src = url;
    return () => {
      if (typeof source !== "string") URL.revokeObjectURL(url);
    };
  }, [source]);

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      drag.current = { x: 0, y: 0, tx, ty, pinchD: Math.hypot(dx, dy), pinchScale: scale };
    } else {
      drag.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, tx, ty };
    }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!drag.current) return;
    if (e.touches.length === 2 && drag.current.pinchD) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const d = Math.hypot(dx, dy);
      const next = (drag.current.pinchScale ?? 1) * (d / drag.current.pinchD);
      const clamped = Math.max(fitScale, Math.min(8, next));
      setScale(clamped);
      const c = clampTranslate(clamped, tx, ty);
      setTx(c.x); setTy(c.y);
    } else {
      const nx = drag.current.tx + (e.touches[0].clientX - drag.current.x);
      const ny = drag.current.ty + (e.touches[0].clientY - drag.current.y);
      const c = clampTranslate(scale, nx, ny);
      setTx(c.x); setTy(c.y);
    }
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    // If we drop from 2 fingers to 1, re-anchor pan baseline to avoid jumps.
    if (e.touches.length === 1) {
      drag.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, tx, ty };
    } else if (e.touches.length === 0) {
      drag.current = null;
    }
  };

  const onMouseDown = (e: React.MouseEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, tx, ty };
    const move = (ev: MouseEvent) => {
      if (!drag.current) return;
      const nx = drag.current.tx + (ev.clientX - drag.current.x);
      const ny = drag.current.ty + (ev.clientY - drag.current.y);
      const c = clampTranslate(scale, nx, ny);
      setTx(c.x); setTy(c.y);
    };
    const up = () => {
      drag.current = null;
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  const confirm = async () => {
    if (!src) return;
    const img = new Image();
    img.src = src;
    await new Promise<void>((r) => { img.onload = () => r(); });

    // Image is rendered centered in FRAME, displayed at (imgSize * scale), then translated by (tx, ty).
    const imgScreenX = FRAME / 2 + tx - (imgSize.w * scale) / 2;
    const imgScreenY = FRAME / 2 + ty - (imgSize.h * scale) / 2;
    const sx = -imgScreenX / scale;
    const sy = -imgScreenY / scale;
    const sw = FRAME / scale;
    const sh = FRAME / scale;

    // Output size = number of source pixels under the frame (no artificial cap).
    const outSize = Math.max(64, Math.round(sw));
    const canvas = document.createElement("canvas");
    canvas.width = outSize;
    canvas.height = outSize;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, outSize, outSize);
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outSize, outSize);
    canvas.toBlob((blob) => { if (blob) onConfirm(blob); }, "image/jpeg", 0.95);
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black px-6 pt-10 pb-8">
      {onSkip && (
        <button
          onClick={onSkip}
          className="absolute right-5 top-5 text-xs uppercase tracking-[0.18em] text-muted-foreground"
        >
          Skip
        </button>
      )}
      <button
        onClick={onCancel}
        className="absolute left-5 top-5 text-xs uppercase tracking-[0.18em] text-muted-foreground"
      >
        Cancel
      </button>
      <p className="mb-6 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        Pinch / drag to crop
      </p>
      <div
        className="relative overflow-hidden rounded-full border border-white/15"
        style={{ width: FRAME, height: FRAME, touchAction: "none" }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
      >
        {src && imgSize.w > 0 && (
          <img
            src={src}
            draggable={false}
            alt=""
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: imgSize.w,
              height: imgSize.h,
              transform: `translate(-50%, -50%) translate(${tx}px, ${ty}px) scale(${scale})`,
              transformOrigin: "center",
              userSelect: "none",
              pointerEvents: "none",
              willChange: "transform",
            }}
          />
        )}
      </div>
      <input
        type="range"
        min={fitScale}
        max={Math.max(fitScale * 4, 5)}
        step={0.01}
        value={scale}
        onChange={(e) => setScaleClamped(parseFloat(e.target.value))}
        className="mt-6 w-full max-w-xs accent-white"
      />
      <div className="mt-6 flex w-full max-w-xs flex-col gap-2">
        <button
          onClick={confirm}
          className="w-full rounded-full bg-white py-3 text-sm font-medium text-black"
        >
          Use this photo
        </button>
        {onChooseAnother && (
          <button
            onClick={onChooseAnother}
            className="w-full rounded-full border border-white/15 py-3 text-sm"
          >
            Choose another
          </button>
        )}
      </div>
    </div>
  );
}