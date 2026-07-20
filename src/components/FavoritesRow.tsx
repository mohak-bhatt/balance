import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { useState } from "react";
import { Icon } from "./Icon";
import { formatCurrency, type Favorite } from "@/lib/ledger";

interface Props {
  favorites: Favorite[];
  onUse: (fav: Favorite) => void;
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
      animate={{ scale: pressed ? 0.9 : 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 22 }}
      onPointerDown={() => setPressed(true)}
      onPointerUp={release}
      onPointerCancel={release}
      onPointerLeave={release}
      onBlur={release}
      onClick={() => {
        release();
        // defer slightly so the bounce-back animation has a frame to start
        setTimeout(onClick, 60);
      }}
      className={className}
    >
      {children}
    </motion.button>
  );
}

export function FavoritesRow({ favorites, onUse, onCreate, hideHeader }: Props) {
  return (
    <div>
      {!hideHeader && (
        <p className="mb-3 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          Favorites
        </p>
      )}
      <div className="grid grid-cols-4 gap-x-3 gap-y-4">
        {favorites.map((f) => (
          <BounceTile
            key={f.id}
            onClick={() => onUse(f)}
            className="flex flex-col items-center gap-1.5 py-1 min-w-0"
          >
            <span className="grid h-14 w-14 place-items-center rounded-full border border-white/10">
              <Icon name={f.icon} size={20} strokeWidth={1.5} />
            </span>
            <p className="w-full truncate text-center text-[11px] font-medium leading-tight">
              {f.label}
            </p>
            {f.presetAmount != null && (
              <p className="font-mono-display text-[10px] leading-tight text-muted-foreground">
                {formatCurrency(f.presetAmount)}
              </p>
            )}
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
