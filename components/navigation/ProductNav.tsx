import Link from "next/link";
import { AudioLines, Code2, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

export type GauchoProduct = "chat" | "studio" | "soundcase";

const PRODUCTS = [
  { id: "chat", href: "/", label: "Chat", icon: MessageSquare },
  { id: "studio", href: "/studio", label: "Studio", icon: Code2 },
  { id: "soundcase", href: "/soundcase", label: "SoundCase", icon: AudioLines },
] as const;

export function ProductNav({ active, compact = false, className }: {
  active: GauchoProduct;
  compact?: boolean;
  className?: string;
}) {
  return (
    <nav className={cn("gc-product-nav", compact && "gc-product-nav-compact", className)} aria-label="Produtos Gaucho">
      {PRODUCTS.map(({ id, href, label, icon: Icon }) => (
        <Link
          key={id}
          href={href}
          aria-current={active === id ? "page" : undefined}
          className={id === "studio" ? "gc-product-nav-desktop-only" : undefined}
          title={label}
        >
          {compact ? <Icon aria-hidden="true" /> : null}<span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
