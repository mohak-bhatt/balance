import { AnimatePresence, motion, useMotionValue, useTransform, type PanInfo } from "framer-motion";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { haptic } from "@/lib/haptics";

interface Props {
  children: ReactNode;
  onDelete: () => void;
}

export function SwipeDeleteRow({ children, onDelete }: Props) {
  const x = useMotionValue(0);
  const bg = useTransform(x, [-160, -40, 0], [1, 0.5, 0]);
  const [gone, setGone] = useState(false);

  return (
    <AnimatePresence>
      {!gone && (
        <motion.div
          layout
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 0.6, y: -16, filter: "blur(8px)", transition: { duration: 0.3 } }}
          transition={{ type: "spring", stiffness: 220, damping: 22 }}
          className="relative overflow-hidden rounded-2xl"
        >
          <motion.div
            className="absolute inset-0 flex items-center justify-end bg-destructive/80 px-5 text-destructive-foreground"
            style={{ opacity: bg }}
          >
            <Trash2 size={16} />
          </motion.div>
          <motion.div
            drag="x"
            dragConstraints={{ left: -180, right: 0 }}
            dragElastic={0.3}
            onDragEnd={(_: unknown, info: PanInfo) => {
              if (info.offset.x < -120) {
                haptic("thud");
                setGone(true);
                setTimeout(onDelete, 280);
              }
            }}
            dragTransition={{ bounceStiffness: 400, bounceDamping: 22 }}
            style={{ x }}
            className="relative bg-background"
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
