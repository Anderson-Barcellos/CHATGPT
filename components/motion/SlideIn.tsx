"use client";

import { motion, useReducedMotion } from "framer-motion";

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
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={shouldReduceMotion ? { opacity: 1, x: 0, y: 0 } : getInitial(from, distance)}
      animate={{ opacity: 1, y: 0, x: 0 }}
      transition={
        shouldReduceMotion
          ? { duration: 0 }
          : { duration, delay, ease: [0.34, 1.56, 0.64, 1] }
      }
      className={className}
    >
      {children}
    </motion.div>
  );
}
