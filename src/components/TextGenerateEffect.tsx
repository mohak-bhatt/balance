import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

interface TextGenerateEffectProps {
  text: string;
  className?: string;
  wordDelay?: number;
}

export function TextGenerateEffect({ text, className = "", wordDelay = 0.12 }: TextGenerateEffectProps) {
  const words = text.split(" ");
  const [key, setKey] = useState(0);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setKey((k) => k + 1);
  }, [text]);

  return (
    <span className={className} key={key}>
      {words.map((word, i) => (
        <motion.span
          key={`${key}-${i}`}
          initial={{ opacity: 0, filter: "blur(8px)" }}
          animate={{ opacity: 1, filter: "blur(0px)" }}
          transition={{ duration: 0.4, delay: i * wordDelay, ease: "easeOut" }}
          className="inline-block"
        >
          {word}
          {i < words.length - 1 ? "\u00A0" : ""}
        </motion.span>
      ))}
    </span>
  );
}