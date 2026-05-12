"use client";

import { motion, useReducedMotion } from "framer-motion";

interface PopProps {
  children: React.ReactNode;
  scale?: number;
  delay?: number;
  duration?: number;
  className?: string;
}

export function Pop({ children, scale = 0.92, delay = 0, duration = 0.2, className }: PopProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={shouldReduceMotion ? { opacity: 1, scale: 1 } : { opacity: 0, scale }}
      animate={{ opacity: 1, scale: 1 }}
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
