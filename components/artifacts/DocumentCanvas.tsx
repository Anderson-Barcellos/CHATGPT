"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DocumentCanvasProps {
  children: ReactNode;
  className?: string;
  pageClassName?: string;
  bodyClassName?: string;
  title?: string;
  eyebrow?: string;
  description?: string;
  compact?: boolean;
}

export function DocumentCanvas({
  children,
  className,
  pageClassName,
  bodyClassName,
  title,
  eyebrow,
  description,
  compact = false,
}: DocumentCanvasProps) {
  const hasHeader = Boolean(title || eyebrow || description);

  return (
    <div
      className={cn(
        "relative mx-auto w-full max-w-5xl overflow-hidden rounded-[30px] border border-black/5",
        "bg-[linear-gradient(180deg,rgba(248,250,252,0.92),rgba(226,232,240,0.65))]",
        "p-3 shadow-[0_28px_90px_rgba(15,23,42,0.10)] backdrop-blur-sm md:p-5",
        "dark:border-white/8 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.94),rgba(2,6,23,0.88))]",
        "dark:shadow-[0_28px_100px_rgba(2,6,23,0.38)]",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.36),transparent_48%)] dark:bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_52%)]" />
      <div
        className={cn(
          "relative mx-auto w-full max-w-[760px] rounded-[26px] border border-slate-200/80 bg-white text-slate-900",
          "shadow-[0_18px_55px_rgba(15,23,42,0.12)] dark:border-white/10 dark:bg-slate-950/95 dark:text-slate-50",
          "dark:shadow-[0_24px_70px_rgba(2,6,23,0.46)]",
          pageClassName
        )}
      >
        {hasHeader && (
          <div
            className={cn(
              "border-b border-slate-200/80 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,0.98))]",
              "px-5 py-5 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.86),rgba(2,6,23,0.18))]",
              compact ? "md:px-8 md:py-5" : "md:px-10 md:py-7"
            )}
          >
            {eyebrow && (
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                {eyebrow}
              </div>
            )}
            {title && (
              <h2
                className={cn(
                  "mt-2 font-semibold tracking-tight text-slate-950 dark:text-slate-50",
                  compact ? "text-lg md:text-[1.45rem]" : "text-[1.65rem] md:text-[1.95rem]"
                )}
              >
                {title}
              </h2>
            )}
            {description && (
              <p
                className={cn(
                  "mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300/80",
                  compact && "text-[13px] leading-5"
                )}
              >
                {description}
              </p>
            )}
          </div>
        )}

        <div
          className={cn(
            "relative",
            compact ? "px-5 py-6 md:px-8 md:py-8" : "px-5 py-7 md:px-10 md:py-10",
            bodyClassName
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
