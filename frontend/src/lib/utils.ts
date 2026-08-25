/**
 * Tailwind className helper — merges Tailwind classes intelligently
 * Combines clsx (conditional classes) + tailwind-merge (de-duplicates)
 *
 * Usage: cn('p-4', active && 'bg-blue-600', 'p-2')  →  'p-2 bg-blue-600'
 * (tailwind-merge resolved the 'p-4' vs 'p-2' conflict by keeping the later one)
 */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
