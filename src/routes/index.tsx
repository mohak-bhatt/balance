import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { HomeContent } from "@/components/HomeContent";
import { BottomPill } from "@/components/BottomPill";
import { haptic } from "@/lib/haptics";
import { useNavigate } from "@tanstack/react-router";
import { useFocusMode } from "@/lib/FocusModeContext";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Balance" },
      { name: "description", content: "An offline-first, OLED-black personal finance tracker." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const navigate = useNavigate();
  const { isFocusMode } = useFocusMode();

  const onDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const swipedLeft = info.offset.x < -80 || info.velocity.x < -500;
    const swipedRight = info.offset.x > 80 || info.velocity.x > 500;
    if (swipedLeft) {
      haptic("medium");
      navigate({ to: "/analytics" });
    } else if (swipedRight) {
      haptic("medium");
      navigate({ to: "/history" });
    }
  };

  return (
    <>
      <motion.div
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
        <HomeContent />
      </motion.div>
      <AnimatePresence initial={false}>
        {!isFocusMode && (
          <motion.div
            key="bottom-pill"
            initial={{ opacity: 0, filter: "blur(8px)", y: 12 }}
            animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
            exit={{ opacity: 0, filter: "blur(8px)", y: 12 }}
            transition={{ type: "spring", stiffness: 180, damping: 28, mass: 1 }}
          >
            <BottomPill />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
