import { cn } from "@/lib/utils";
import { OpenAIIcon } from "@/components/ui/icons";

export function TypingIndicator() {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <OpenAIIcon className="h-4 w-4 text-primary" />
      </div>
      <div
        className={cn(
          "flex items-center gap-1.5 rounded-2xl px-4 py-3",
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
