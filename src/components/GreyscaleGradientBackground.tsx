import { motion } from "framer-motion";

export function GreyscaleGradientBackground({ speedKey }: { speedKey: string | number }) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none bg-black">
      <motion.div
        key={speedKey}
        className="absolute -inset-[60%]"
        initial={{ rotate: -220, scale: 1.35, opacity: 1 }}
        animate={{ rotate: 0, scale: 1, opacity: 0 }}
        transition={{
          rotate: { duration: 1.5, ease: [0.16, 1, 0.3, 1] },
          scale: { duration: 1.8, ease: [0.16, 1, 0.3, 1] },
          opacity: { duration: 1, delay: 1.2, ease: "easeInOut" },
        }}
        style={{
          background:
            "radial-gradient(circle at 30% 30%, rgba(90,90,90,0.16) 0%, rgba(90,90,90,0.05) 40%, transparent 70%), radial-gradient(circle at 70% 60%, rgba(65,65,65,0.13) 0%, rgba(65,65,65,0.04) 40%, transparent 70%), radial-gradient(circle at 50% 90%, rgba(45,45,45,0.11) 0%, rgba(45,45,45,0.03) 40%, transparent 70%)",
          filter: "blur(110px)",
        }}
      />

      {/* Noise overlay, also fades out with the gradient */}
      <motion.svg
        key={`noise-${speedKey}`}
        className="absolute inset-0 h-full w-full"
        style={{ mixBlendMode: "overlay" }}
        initial={{ opacity: 0.06 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 1, delay: 1.2, ease: "easeOut" }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <filter id="noiseFilter">
          <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="3" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#noiseFilter)" />
      </motion.svg>
    </div>
  );
}