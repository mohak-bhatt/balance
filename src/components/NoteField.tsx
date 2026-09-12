import { useEffect, useRef, useState } from "react";
import { FileText } from "lucide-react";

interface Props {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

/**
 * A single note field that never changes its resting shape/size regardless of
 * whether a note exists: collapsed it shows either a "+ Add a note" placeholder
 * or a centered preview of the existing note (same box, same height). Tapping
 * it switches to an editable textarea; blurring returns to the same collapsed box.
 */
export function NoteField({ value, onChange, className = "" }: Props) {
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editing) return;
    const t = window.setTimeout(() => ref.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [editing]);

  if (editing) {
    return (
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setEditing(false)}
        placeholder="Optional notes…"
        rows={2}
        className={`h-[3.75rem] w-full resize-none rounded-2xl border border-white/10 bg-transparent p-3 text-center text-sm outline-none placeholder:text-muted-foreground/40 ${className}`}
      />
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className={`flex h-11 w-full items-center justify-center gap-2 rounded-full border border-white/10 px-3 text-center text-xs text-muted-foreground ${className}`}
    >
      {value.trim() ? (
        <span className="truncate text-foreground/90">{value}</span>
      ) : (
        <>
          <FileText size={13} strokeWidth={1.6} />
          Add a note
        </>
      )}
    </button>
  );
}