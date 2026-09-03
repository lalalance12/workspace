import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * The shadcn class helper: merge conditional classes, then let tailwind-merge
 * resolve conflicts so a caller's `px-3` beats a component's default `px-4`
 * instead of both landing in the class list and the cascade picking arbitrarily.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
