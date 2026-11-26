"use client";

import type { MouseEvent } from "react";
import { Toaster, toast } from "sonner";

/** Keeps toasts below the store (76px) and panel (64px) headers. */
const TOP_OFFSET = "calc(5.25rem + env(safe-area-inset-top))";

export function AppToaster() {
  function handleClick(event: MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;

    if (!target.closest("[data-sonner-toast]")) return;
    // Action and close buttons already have their own behavior.
    if (target.closest("button")) return;

    toast.dismiss();
  }

  return (
    <div onClick={handleClick}>
      <Toaster
        richColors
        position="top-center"
        offset={{ top: TOP_OFFSET }}
        mobileOffset={{ top: TOP_OFFSET }}
        swipeDirections={["top", "right", "bottom", "left"]}
      />
    </div>
  );
}
