"use client";

import { AnimatePresence, motion } from "framer-motion";

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
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          variants={getVariants(side)}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={{ duration: 0.35, ease: [0.2, 0, 0, 1] }}
          className={className}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
