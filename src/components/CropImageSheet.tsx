import Cropper, { type Area } from "react-easy-crop";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useOverlayState } from "@/lib/OverlayContext";

interface Props {
  file: File | null;
  onCancel: () => void;
  onComplete: (blob: Blob) => void | Promise<void>;
}

function createCroppedAvatar(imageSrc: string, area: Area): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 512;
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Could not create image canvas"));
        return;
      }
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(
        image,
        area.x,
        area.y,
        area.width,
        area.height,
        0,
        0,
        canvas.width,
        canvas.height,
      );
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Could not export cropped image"))),
        "image/jpeg",
        0.86,
      );
    };
    image.onerror = () => reject(new Error("Could not read selected image"));
    image.src = imageSrc;
  });
}

export function CropImageSheet({ file, onCancel, onComplete }: Props) {
  const open = Boolean(file);
  useOverlayState(open, onCancel);
  useBodyScrollLock(open);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!file) {
      setImageSrc(null);
      setArea(null);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setSaving(false);
      return;
    }
    const url = URL.createObjectURL(file);
    setImageSrc(url);
    setArea(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const confirm = async () => {
    if (!imageSrc || !area || saving) return;
    setSaving(true);
    try {
      const blob = await createCroppedAvatar(imageSrc, area);
      await onComplete(blob);
    } finally {
      setSaving(false);
    }
  };

  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {open && imageSrc && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[120] grid place-items-end bg-black/70 px-0 sm:place-items-center sm:px-5"
          onClick={onCancel}
        >
          <motion.div
            initial={{ y: 32, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 32, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 360, damping: 30 }}
            className="w-full max-w-md overflow-hidden rounded-t-[28px] border border-white/10 bg-black sm:rounded-[28px]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pb-3 pt-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Profile photo</p>
                <h2 className="mt-1 font-mono-display text-xl">Adjust your photo</h2>
              </div>
              <button type="button" onClick={onCancel} className="rounded-full p-2 text-muted-foreground" aria-label="Cancel crop">
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>
            <div className="relative mx-5 aspect-square overflow-hidden rounded-2xl bg-white/[0.04]">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_, croppedAreaPixels) => setArea(croppedAreaPixels)}
              />
            </div>
            <div className="px-5 pt-4">
              <label className="block text-[10px] uppercase tracking-[0.22em] text-muted-foreground" htmlFor="avatar-zoom">
                Zoom
              </label>
              <input
                id="avatar-zoom"
                type="range"
                min="1"
                max="3"
                step="0.01"
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
                className="mt-3 w-full accent-white"
              />
            </div>
            <div className="flex gap-2 px-5 pb-5 pt-5">
              <button type="button" onClick={onCancel} className="flex-1 rounded-xl border border-white/15 py-3 text-sm text-white">
                Cancel
              </button>
              <button type="button" onClick={confirm} disabled={!area || saving} className="flex-1 rounded-xl bg-white py-3 text-sm font-medium text-black disabled:opacity-40">
                {saving ? "Saving..." : "Use photo"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
