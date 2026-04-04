import { cn } from "@/lib/utils";
import { OpenAIIcon } from "@/components/ui/icons";

export function TypingIndicator() {
  return (
    <div className="flex items-start gap-2 md:gap-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 md:h-8 md:w-8">
        <OpenAIIcon className="h-3.5 w-3.5 text-primary md:h-4 md:w-4" />
      </div>
      <div
        className={cn(
          "flex items-center gap-1.5 rounded-xl px-3 py-2.5 md:rounded-2xl md:px-4 md:py-3",
          "bg-card border shadow-sm"
        )}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="inline-block h-2 w-2 rounded-full bg-primary/60 animate-bounce"
            style={{ animationDelay: `${i * 0.15}s`, animationDuration: "1s" }}
          />
        ))}
      </div>
    </div>
  );
}
