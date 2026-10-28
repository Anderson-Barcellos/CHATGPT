import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// Os degraus da régua (app/globals.css, @theme) são tamanhos de fonte; sem
// isto o twMerge os lê como cor e descarta text-nano ao lado de text-muted-*.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["nano", "micro", "caption", "body-sm", "body", "h3", "h2", "h1"],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function apiUrl(path: string): string {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  return `${basePath}${path}`;
}
