import { motion } from "framer-motion";
import { Plus, ArrowDown, ArrowUp } from "lucide-react";
import { useState } from "react";
import { Icon } from "./Icon";
import { formatCurrency, type Loop } from "@/lib/ledger";

interface Props {
  loops: Loop[];
  onUse?: (loop: Loop) => void;
  onCreate: () => void;
  hideHeader?: boolean;
}

function BounceTile({
  onClick,
  children,
  className,
}: {
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  const [pressed, setPressed] = useState(false);
  const release = () => setPressed(false);
  return (
    <motion.button
      type="button"
      animate={{ scale: pressed ? 0.92 : 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 22 }}
      onPointerDown={() => setPressed(true)}
      onPointerUp={release}
      onPointerCancel={release}
      onPointerLeave={release}
      onBlur={release}
      onClick={() => {
        release();
        setTimeout(onClick, 60);
      }}
      className={className}
    >
      {children}
    </motion.button>
  );
}

export function LoopsRow({ loops, onUse, onCreate, hideHeader }: Props) {
  return (
    <div>
      {!hideHeader && (
        <p className="mb-3 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          Loops
        </p>
      )}
      <div className="grid grid-cols-4 gap-x-3 gap-y-4">
        {loops.map((l) => (
          <BounceTile
            key={l.id}
            onClick={() => onUse?.(l)}
            className="flex flex-col items-center gap-1.5 py-1 min-w-0"
          >
            <span className="relative grid h-14 w-14 place-items-center rounded-full border border-white/10">
              <Icon name={l.icon} size={20} strokeWidth={1.5} />
              <span
                className="absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full bg-black"
                style={{ color: l.direction === "in" ? "#34D399" : "#F87171" }}
              >
                {l.direction === "in" ? <ArrowUp size={9} strokeWidth={2.2} /> : <ArrowDown size={9} strokeWidth={2.2} />}
              </span>
            </span>
            <p className="w-full truncate text-center text-[11px] font-medium leading-tight">
              {l.label}
            </p>
            <p className="font-mono-display text-[10px] leading-tight text-muted-foreground">
              {formatCurrency(l.amount)}
            </p>
          </BounceTile>
        ))}
        <BounceTile
          onClick={onCreate}
          className="flex flex-col items-center gap-1.5 py-1 min-w-0 text-muted-foreground"
        >
          <span className="grid h-14 w-14 place-items-center rounded-full border border-dashed border-white/15">
            <Plus size={18} strokeWidth={1.5} />
          </span>
          <p className="text-[11px] font-medium leading-tight">Add</p>
        </BounceTile>
      </div>
    </div>
  );
}
