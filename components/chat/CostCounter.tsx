"use client";

import { useCostDisplay } from "@/stores/costStore";
import { Coins } from "lucide-react";
import { cn } from "@/lib/utils";

interface CostCounterProps {
  className?: string;
}

export function CostCounter({ className }: CostCounterProps) {
  const { formattedCost, totalTokens } = useCostDisplay();

  if (totalTokens === 0) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5",
        "text-nano font-medium tabular-nums",
        "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
        "border border-emerald-500/15",
        className
      )}
      title={`${totalTokens.toLocaleString("pt-BR")} tokens nesta conversa`}
    >
      <Coins className="size-3 shrink-0" />
      {formattedCost}
    </span>
  );
}
