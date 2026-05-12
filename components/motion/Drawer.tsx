"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

type DrawerSide = "left" | "right" | "bottom";

interface DrawerProps {
  children: React.ReactNode;
  side?: DrawerSide;
  open: boolean;
  className?: string;
}

function getVariants(side: DrawerSide) {
  const hidden =
    side === "bottom" ? { y: "100%" } : side === "left" ? { x: "-100%" } : { x: "100%" };
  return {
    hidden: { ...hidden, opacity: 0 },
    visible: { y: 0, x: 0, opacity: 1 },
    exit: { ...hidden, opacity: 0 },
  };
}

export function Drawer({ children, side = "right", open, className }: DrawerProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          variants={shouldReduceMotion ? undefined : getVariants(side)}
          initial={shouldReduceMotion ? { opacity: 1, x: 0, y: 0 } : "hidden"}
          animate={shouldReduceMotion ? { opacity: 1, x: 0, y: 0 } : "visible"}
          exit={shouldReduceMotion ? { opacity: 1, x: 0, y: 0 } : "exit"}
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : { duration: 0.35, ease: [0.2, 0, 0, 1] }
          }
          className={className}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
