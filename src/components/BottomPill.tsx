import { motion } from "framer-motion";
import { BarChart3, History, Plus } from "lucide-react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { haptic } from "@/lib/haptics";

const SPRING = { type: "spring" as const, stiffness: 320, damping: 22 };

export function BottomPill() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const activeIndex: 0 | 1 | 2 =
    pathname === "/history" ? 1 : pathname === "/analytics" ? 2 : 0;

  const onCenter = () => {
    haptic("tick");
    if (activeIndex === 0) {
      window.dispatchEvent(new Event("balance:add"));
    } else {
      navigate({ to: "/" });
    }
  };

  return (
    <div
      className="pointer-events-none fixed left-0 right-0 bottom-0 z-20"
      style={{
        paddingBottom: "2.5rem",
      }}
    >
      <div className="mx-auto flex max-w-md justify-center px-6">
        <div
          className="nothing-fab pointer-events-auto flex items-center gap-2 rounded-full px-3 py-2"
          role="navigation"
          aria-label="Primary"
        >
          <Link to="/history" onClick={() => haptic("tick")} aria-label="History" data-tutorial="history">
            <motion.span
              whileTap={{ scale: 0.88 }}
              transition={SPRING}
              className="relative grid h-12 w-12 place-items-center rounded-full text-foreground/90"
            >
              <History size={20} strokeWidth={1.6} />
              {activeIndex === 1 && (
                <span className="pointer-events-none absolute -bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-white" />
              )}
            </motion.span>
          </Link>
          <motion.button
            whileTap={{ scale: 0.86 }}
            transition={SPRING}
            onClick={onCenter}
            className="grid h-14 w-14 place-items-center rounded-full text-foreground/95"
            aria-label={activeIndex === 0 ? "Add expense" : "Back to home"}
            data-tutorial="plus"
          >
            <Plus size={26} strokeWidth={1.6} />
          </motion.button>
          <Link to="/analytics" onClick={() => haptic("tick")} aria-label="Analytics" data-tutorial="analytics">
            <motion.span
              whileTap={{ scale: 0.88 }}
              transition={SPRING}
              className="relative grid h-12 w-12 place-items-center rounded-full text-foreground/90"
            >
              <BarChart3 size={20} strokeWidth={1.6} />
              {activeIndex === 2 && (
                <span className="pointer-events-none absolute -bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-white" />
              )}
            </motion.span>
          </Link>
        </div>
      </div>
    </div>
  );
}
