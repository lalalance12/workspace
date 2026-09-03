"use client";

import * as PopoverPrimitive from "@radix-ui/react-popover";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/**
 * shadcn's Popover, styled with this project's tokens rather than shadcn's
 * defaults. Radix supplies the behaviour that is genuinely hard — focus
 * trapping, outside-click, escape, collision-aware placement — and the look
 * comes from .panel like every other surface here.
 */
export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;

export function PopoverContent({
  className,
  align = "start",
  sideOffset = 6,
  ...props
}: ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "panel z-50 w-auto p-3 outline-none",
          // Radix sets data-state and data-side; the entrance matches .rise-in
          // rather than introducing a second motion vocabulary.
          "data-[state=open]:animate-[rise-in_180ms_cubic-bezier(0.2,0.8,0.2,1)_both]",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}
