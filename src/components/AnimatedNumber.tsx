import { animate, useMotionValue, useTransform, motion } from "framer-motion";
import { useEffect } from "react";

interface Props {
  value: number;
  prefix?: string;
  className?: string;
  decimals?: number;
  initialValue?: number;
}

export function AnimatedNumber({ value, prefix = "₹", className, decimals = 0, initialValue }: Props) {
  const mv = useMotionValue(initialValue ?? value);
  const rounded = useTransform(mv, (v: number) => {
    const n = decimals > 0 ? v.toFixed(decimals) : Math.round(v).toLocaleString("en-IN");
    return prefix + n;
  });

  useEffect(() => {
    const controls = animate(mv, value, {
      type: "spring",
      stiffness: 90,
      damping: 18,
      mass: 0.9,
    });
    return controls.stop;
  }, [value, mv]);

  return <motion.span className={className}>{rounded}</motion.span>;
}
