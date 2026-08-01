import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { AnalyticsContent } from "@/components/AnalyticsContent";
import { BottomPill } from "@/components/BottomPill";

export const Route = createFileRoute("/analytics")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: search.tab === "monthly" ? ("monthly" as const) : ("weekly" as const),
  }),
  head: () => ({ meta: [{ title: "Analytics — Balance" }] }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { tab } = Route.useSearch();

  return (
    <>
      <motion.div
        initial={{ x: 28, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 32, mass: 0.7 }}
      >
        <AnalyticsContent initialTab={tab} />
      </motion.div>
      <BottomPill />
    </>
  );
}
