"use client";

import type { ReactNode } from "react";
import { usePathname } from "@/i18n/navigation";
import { isInactiveRestrictedPath } from "@/lib/member-panel-access";
import { MemberAccessNotice } from "./member-access-notice";

/**
 * Keeps INACTIVE members signed in while showing a soft preview of the page
 * behind the notice. The preview is taken out of layout so the notice always
 * sits in the same, fully visible position regardless of the page underneath.
 */
export function InactiveAccessGate({
  status,
  note,
  availablePaisa,
  children,
}: {
  status: "INACTIVE" | "ACTIVE" | "SUSPENDED";
  note?: string | null;
  availablePaisa?: string;
  children: ReactNode;
}) {
  const pathname = usePathname();

  if (status !== "INACTIVE" || !isInactiveRestrictedPath(pathname)) {
    return <>{children}</>;
  }

  return (
    <div className="relative isolate min-h-[38rem] rounded-3xl">
      <div
        aria-hidden="true"
        inert
        className="pointer-events-none absolute inset-0 z-0 select-none overflow-hidden rounded-3xl opacity-30 blur-[6px]"
      >
        {children}
      </div>
      <div className="relative z-10 flex min-h-[38rem] items-center justify-center px-0 py-5 sm:px-4 sm:py-10">
        <MemberAccessNotice
          status="INACTIVE"
          note={note}
          availablePaisa={availablePaisa ?? "0"}
        />
      </div>
    </div>
  );
}
