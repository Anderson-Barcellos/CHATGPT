"use client";

import { useState, useEffect } from "react";
import { GPTLogo } from "@/components/ui/gpt-logo";
import { cn } from "@/lib/utils";

export function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState<"logo" | "brand" | "shrink" | "done">("logo");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("brand"), 800);
    const t2 = setTimeout(() => setPhase("shrink"), 2200);
    const t3 = setTimeout(() => {
      setPhase("done");
      onComplete();
    }, 3000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onComplete]);

  if (phase === "done") return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex flex-col items-center justify-center",
        "transition-opacity duration-700",
        phase === "shrink" ? "opacity-0 scale-90" : "opacity-100"
      )}
      style={{
        background: "radial-gradient(ellipse at 50% 40%, oklch(0.26 0.04 242) 0%, oklch(0.20 0.03 248) 50%, oklch(0.16 0.025 250) 100%)",
      }}
    >
      <div
        className={cn(
          "transition-all duration-1000 ease-out",
          phase === "logo" && "scale-100 opacity-100",
          phase === "brand" && "scale-90 opacity-100",
          phase === "shrink" && "scale-50 opacity-0"
        )}
      >
        <GPTLogo size={200} className="animate-float" />
      </div>

      <h1
        className={cn(
          "mt-4 text-5xl font-bold tracking-widest transition-all duration-700",
          "text-gradient-gpt",
          phase === "logo" && "opacity-0 translate-y-6",
          phase === "brand" && "opacity-100 translate-y-0",
          phase === "shrink" && "opacity-0 -translate-y-4"
        )}
        style={{ fontFamily: "'Inter', sans-serif" }}
      >
        GPT
      </h1>

      <p
        className={cn(
          "mt-3 text-sm tracking-[0.5em] uppercase font-medium transition-all duration-700 delay-200",
          "text-cyan-400/70",
          phase === "logo" && "opacity-0",
          phase === "brand" && "opacity-100",
          phase === "shrink" && "opacity-0"
        )}
      >
        Nothing buys time
      </p>
    </div>
  );
}
