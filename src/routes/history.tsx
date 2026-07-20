import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { HistoryContent } from "@/components/HistoryContent";
import { BottomPill } from "@/components/BottomPill";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "History · Balance" },
      { name: "description", content: "Your full transaction history." },
    ],
  }),
  component: () => (
    <>
      <motion.div
        initial={{ x: -28, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 32, mass: 0.7 }}
      >
        <HistoryContent />
      </motion.div>
      <BottomPill />
    </>
  ),
});
