import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import type { PanInfo } from "framer-motion";
import { HistoryContent } from "@/components/HistoryContent";
import { BottomPill } from "@/components/BottomPill";
import { haptic } from "@/lib/haptics";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "History · Balance" },
      { name: "description", content: "Your full transaction history." },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const navigate = useNavigate();

  const onDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.x < -80 || info.velocity.x < -500) {
      haptic("medium");
      navigate({ to: "/" });
    }
  };

  return (
    <>
      <motion.div
        initial={{ x: 28, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 32, mass: 0.7 }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.12}
        dragMomentum={false}
        onDragEnd={onDragEnd}
        onPointerDown={(event) => {
          if ((event.target as HTMLElement).closest("button, a, input, textarea, select, [data-swipe-ignore]")) {
            event.stopPropagation();
          }
        }}
      >
        <HistoryContent />
      </motion.div>
      <BottomPill />
    </>
  );
}
