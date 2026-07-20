import { motion } from "framer-motion";
import type { ReactNode } from "react";

export const NOTHING_YELLOW = "#F5C518";
const SPRING = { type: "spring" as const, stiffness: 380, damping: 18 };

function PlainArrow({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#000"
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ pointerEvents: "none" }}
    >
      <line x1="4" y1="12" x2="20" y2="12" />
      <polyline points="13 5 20 12 13 19" />
    </svg>
  );
}

export function YellowArrowButton({
  onClick, disabled, ariaLabel = "Continue", type = "button",
}: { onClick?: () => void; disabled?: boolean; ariaLabel?: string; type?: "button" | "submit" }) {
  return (
    <motion.button
      type={type}
      whileTap={{ scale: 0.9 }}
      transition={SPRING}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className="flex h-14 w-full items-center justify-center gap-3 rounded-full disabled:opacity-30"
      style={{ background: NOTHING_YELLOW }}
    >
      <PlainArrow size={32} />
    </motion.button>
  );
}

export function YellowPillButton({
  children, onClick, disabled,
}: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.97 }}
      transition={SPRING}
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-full py-4 text-sm font-bold uppercase tracking-[0.2em] text-black disabled:opacity-40"
      style={{ background: NOTHING_YELLOW }}
    >
      {children}
    </motion.button>
  );
}
