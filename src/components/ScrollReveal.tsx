import { motion } from "framer-motion";

export function ScrollReveal({ children, className = "", once = false }: { children: React.ReactNode; className?: string; once?: boolean }) {
  return (
    <motion.div
      className={`reveal-compositor ${className}`}
      initial={{ opacity: 0, filter: "blur(8px)", y: 12 }}
      whileInView={{ opacity: 1, filter: "blur(0px)", y: 0 }}
      exit={{ opacity: 0, filter: "blur(8px)", y: 12 }}
      viewport={{ once, margin: "-60px" }}
      transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
