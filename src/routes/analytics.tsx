import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import type { PanInfo } from "framer-motion";
import { AnalyticsContent } from "@/components/AnalyticsContent";
import { BottomPill } from "@/components/BottomPill";
import { haptic } from "@/lib/haptics";
import { useNavigate } from "@tanstack/react-router";
import { useRouteBackToHome } from "@/hooks/useRouteBackToHome";

export const Route = createFileRoute("/analytics")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: search.tab === "monthly" ? ("monthly" as const) : ("weekly" as const),
  }),
  head: () => ({ meta: [{ title: "Analytics — Balance" }] }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { tab } = Route.useSearch();
  const navigate = useNavigate();
  useRouteBackToHome(() => navigate({ to: "/" }));

  const onDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.x > 80 || info.velocity.x > 500) {
      haptic("medium");
      navigate({ to: "/" });
    }
  };

  return (
    <>
      <motion.div
        initial={{ x: -28, opacity: 0 }}
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
        <AnalyticsContent initialTab={tab} />
      </motion.div>
      <BottomPill />
    </>
  );
}
