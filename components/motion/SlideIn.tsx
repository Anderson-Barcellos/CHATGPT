"use client";

import { motion } from "framer-motion";

type SlideFrom = "bottom" | "left" | "right";

interface SlideInProps {
  children: React.ReactNode;
  from?: SlideFrom;
  distance?: number;
  delay?: number;
  duration?: number;
  className?: string;
}

function getInitial(from: SlideFrom, distance: number) {
  if (from === "bottom") return { opacity: 0, y: distance };
  if (from === "left") return { opacity: 0, x: -distance };
  return { opacity: 0, x: distance };
}

export function SlideIn({ children, from = "bottom", distance = 8, delay = 0, duration = 0.2, className }: SlideInProps) {
  return (
    <motion.div
      initial={getInitial(from, distance)}
      animate={{ opacity: 1, y: 0, x: 0 }}
      transition={{ duration, delay, ease: [0.34, 1.56, 0.64, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
