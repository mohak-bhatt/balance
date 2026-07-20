import { useEffect, useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

interface Ripple { x: number; y: number; t: number; }

interface Props {
  rippleSignal?: { x: number; y: number; key: number } | null;
}

/**
 * Subtle full-screen greyscale grid with gentle continuous wave distortion.
 * On rippleSignal, a localized ripple flashes and fades.
 */
export function WaveGrid({ rippleSignal }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const ripples = useRef<Ripple[]>([]);
  const tRef = useRef(0);

  useEffect(() => {
    if (!rippleSignal) return;
    ripples.current.push({ x: rippleSignal.x, y: rippleSignal.y, t: performance.now() });
  }, [rippleSignal]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let w = 0, h = 0, dpr = 1;
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const SPACING = 28;
    const draw = (now: number) => {
      tRef.current = now / 1000;
      const t = tRef.current;
      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = 1;

      // prune old ripples
      ripples.current = ripples.current.filter((r) => now - r.t < 1400);

      const baseAlpha = 0.04;

      // vertical lines
      for (let x = 0; x <= w + SPACING; x += SPACING) {
        ctx.beginPath();
        for (let y = 0; y <= h; y += 6) {
          const wave = Math.sin((y * 0.012) + t * 0.5 + x * 0.005) * 2.2;
          let rx = 0;
          for (const r of ripples.current) {
            const age = (now - r.t) / 1400;
            const dx = x - r.x, dy = y - r.y;
            const d = Math.sqrt(dx*dx + dy*dy);
            const radius = age * 380;
            const band = Math.exp(-Math.pow((d - radius) / 40, 2));
            rx += band * (1 - age) * 10 * (dx / (d + 0.001));
          }
          const px = x + wave + rx;
          if (y === 0) ctx.moveTo(px, y); else ctx.lineTo(px, y);
        }
        ctx.strokeStyle = `rgba(255,255,255,${baseAlpha})`;
        ctx.stroke();
      }

      // horizontal lines
      for (let y = 0; y <= h + SPACING; y += SPACING) {
        ctx.beginPath();
        for (let x = 0; x <= w; x += 6) {
          const wave = Math.cos((x * 0.012) + t * 0.45 + y * 0.005) * 2.2;
          let ry = 0;
          for (const r of ripples.current) {
            const age = (now - r.t) / 1400;
            const dx = x - r.x, dy = y - r.y;
            const d = Math.sqrt(dx*dx + dy*dy);
            const radius = age * 380;
            const band = Math.exp(-Math.pow((d - radius) / 40, 2));
            ry += band * (1 - age) * 10 * (dy / (d + 0.001));
          }
          const py = y + wave + ry;
          if (x === 0) ctx.moveTo(x, py); else ctx.lineTo(x, py);
        }
        ctx.strokeStyle = `rgba(255,255,255,${baseAlpha})`;
        ctx.stroke();
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);

  return (
    <canvas
      ref={ref}
      className="pointer-events-none fixed inset-0 z-0 h-full w-full"
      aria-hidden
    />
  );
}

// avoid unused
export const _ = { motion, useMotionValue, useSpring, useTransform };
