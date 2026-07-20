import { AnimatePresence, motion, useMotionValue, useTransform, type PanInfo } from "framer-motion";
import { useState } from "react";
import { Trash2, ChevronRight, ArrowDownRight, ArrowUpRight, Pencil, Handshake, Check } from "lucide-react";
import { Icon } from "./Icon";
import { AnimatedNumber } from "./AnimatedNumber";
import {
  LENT_OUT_KEY,
  formatCurrency,
  getCategory,
  groupByMonth,
  type Transaction,
} from "@/lib/ledger";

interface Props {
  transactions: Transaction[];
  onDelete: (id: string) => void;
  onEdit: (tx: Transaction) => void;
  onRepayLend?: (tx: Transaction) => void;
  filterCategory?: string | null;
}

export function TransactionList({
  transactions, onDelete, onEdit, onRepayLend, filterCategory,
}: Props) {
  // For category filter, also match multi-item transactions whose items include that cat
  const filtered = filterCategory
    ? transactions.filter((t) =>
        t.category === filterCategory ||
        (t.items?.some((it) => it.category === filterCategory) ?? false),
      )
    : transactions;

  const months = groupByMonth(filtered);

  if (filtered.length === 0) {
    return (
      <div className="py-6 text-center">
        <p className="text-xs text-muted-foreground">
          {filterCategory ? "Nothing in this category yet." : "No transactions yet."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {months.map((mo) => (
        <div key={mo.key}>
          {/* Month header */}
          <div className="mb-2 flex items-baseline justify-between px-1">
            <h3 className="text-[11px] uppercase tracking-[0.22em] text-foreground/70">
              {mo.label}
            </h3>
            <div className="flex gap-3 text-[10px] tabular-nums text-muted-foreground">
              <span className="text-emerald-400/80">+{formatCurrency(mo.inTotal)}</span>
              <span className="text-rose-400/80">−{formatCurrency(mo.outTotal)}</span>
              <span className={mo.net >= 0 ? "text-foreground/70" : "text-rose-400"}>
                {mo.net >= 0 ? "Net " : "Net "}{formatCurrency(mo.net)}
              </span>
            </div>
          </div>

          <div className="space-y-4">
            {mo.days.map(([label, items]) => {
              const dayOut = items.filter((t) => t.direction === "out").reduce((s, t) => s + t.amount, 0);
              const dayIn = items.filter((t) => t.direction === "in").reduce((s, t) => s + t.amount, 0);
              return (
                <div key={`${mo.key}-${label}`}>
                  <div className="mb-1.5 flex items-baseline justify-between px-1">
                    <h4 className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</h4>
                    <span className="text-[11px] tabular-nums text-muted-foreground">
                      {dayIn > 0 && <span className="text-emerald-400/70">+{formatCurrency(dayIn)} </span>}
                      {dayOut > 0 && <span className="text-rose-400/70">−{formatCurrency(dayOut)}</span>}
                    </span>
                  </div>
                  <ul className="space-y-0">
                    <AnimatePresence initial={false}>
                      {items.map((t) => (
                        <SwipeRow
                          key={t.id}
                          tx={t}
                          onDelete={() => onDelete(t.id)}
                          onEdit={() => onEdit(t)}
                          onRepay={t.lentTo && !t.repaid ? () => onRepayLend?.(t) : undefined}
                        />
                      ))}
                    </AnimatePresence>
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function SwipeRow({
  tx, onDelete, onEdit, onRepay,
}: {
  tx: Transaction;
  onDelete: () => void;
  onEdit: () => void;
  onRepay?: () => void;
}) {
  const cat = getCategory(tx.category);
  const isLend = tx.category === LENT_OUT_KEY;
  const isIncome = tx.direction === "in";
  const isItems = (tx.items?.length ?? 0) > 0;
  const x = useMotionValue(0);
  const [expanded, setExpanded] = useState(false);
  const bgL = useTransform(x, [-160, -40, 0], [1, 0.5, 0]);

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 10, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.6, y: -20, filter: "blur(8px)", transition: { duration: 0.3 } }}
      transition={{ type: "spring", stiffness: 220, damping: 22 }}
      className="relative overflow-hidden rounded-2xl"
    >
      <motion.div
        className="absolute inset-0 flex items-center justify-end bg-destructive/80 px-5 text-destructive-foreground"
        style={{ opacity: bgL }}
      >
        <Trash2 size={16} />
      </motion.div>

      <motion.div
        drag="x"
        dragConstraints={{ left: -180, right: 0 }}
        dragElastic={0.3}
        onDragEnd={(_: unknown, info: PanInfo) => { if (info.offset.x < -120) onDelete(); }}
        dragTransition={{ bounceStiffness: 400, bounceDamping: 22 }}
        className="relative active:cursor-grabbing"
        style={
          isLend
            ? { x, borderLeft: `3px solid ${cat.color}`, paddingLeft: 8, background: "rgba(251,191,36,0.04)" }
            : { x }
        }
      >
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex w-full items-center gap-3 border-b border-white/[0.05] px-1 py-3 text-left"
        >
          <div
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border"
            style={{ borderColor: cat.color + "55", color: cat.color }}
          >
            <Icon name={tx.icon || cat.icon} size={14} strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 truncate text-sm font-medium">
              {isLend ? <Handshake size={11} className="text-amber-300" /> : null}
              {isLend ? `Lent to ${tx.lentTo}` : tx.title}
              {tx.repaid && <span className="ml-1 text-[10px] text-emerald-400">✓ Repaid</span>}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              {isLend ? tx.title : cat.label}
              {isItems && (
                <span className="ml-1.5 inline-block rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[9px] uppercase tracking-wide">
                  {tx.items!.length} items
                </span>
              )}
            </p>
          </div>
          <div className="text-right">
            <p className={`font-mono-display text-sm tabular-nums ${tx.repaid ? "line-through opacity-50" : ""}`}>
              <AnimatedNumber value={tx.amount} />
            </p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {new Date(tx.timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            </p>
          </div>
          <span className="ml-1 inline-flex items-center">
            {isIncome
              ? <ArrowUpRight size={14} strokeWidth={1.8} className="text-emerald-400" />
              : <ArrowDownRight size={14} strokeWidth={1.8} className="text-rose-400" />}
          </span>
          <ChevronRight size={14} strokeWidth={1.5} className={`shrink-0 text-muted-foreground/40 transition-transform ${expanded ? "rotate-90" : ""}`} />
        </button>

        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 220, damping: 24 }}
              className="overflow-hidden border-t border-white/5"
            >
              <div className="grid grid-cols-2 gap-3 px-3 py-2.5 text-[11px]">
                <div>
                  <p className="text-muted-foreground">When</p>
                  <p className="mt-0.5 font-medium">
                    {new Date(tx.timestamp).toLocaleString([], {
                      hour: "numeric", minute: "2-digit", day: "numeric", month: "short",
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Method</p>
                  <p className="mt-0.5 font-medium capitalize">{tx.paymentMethod}</p>
                </div>
                {tx.note && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Note</p>
                    <pre className="mt-0.5 overflow-x-auto whitespace-pre bg-transparent font-sans text-[11px]">{tx.note}</pre>
                  </div>
                )}
                {isItems && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Items</p>
                    <ul className="mt-1 space-y-1">
                      {tx.items!.map((it, i) => {
                        const ic = getCategory(it.category);
                        return (
                          <li key={i} className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5" style={{ color: ic.color }}>
                              <Icon name={ic.icon} size={10} /> {it.name || "—"}
                            </span>
                            <span className="font-mono-display tabular-nums text-foreground/80">
                              {formatCurrency(it.amount)}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
              <div className="flex gap-2 border-t border-white/5 px-3 py-2">
                <button
                  onClick={onEdit}
                  className="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-[11px] text-foreground/80"
                >
                  <Pencil size={11} /> Edit
                </button>
                {onRepay && (
                  <button
                    onClick={onRepay}
                    className="flex items-center gap-1.5 rounded-full border border-emerald-400/30 px-3 py-1.5 text-[11px] text-emerald-300"
                  >
                    <Check size={11} /> Mark as repaid
                  </button>
                )}
                <button
                  onClick={onDelete}
                  className="ml-auto flex items-center gap-1.5 rounded-full border border-rose-400/30 px-3 py-1.5 text-[11px] text-rose-300"
                >
                  <Trash2 size={11} /> Delete
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.li>
  );
}
