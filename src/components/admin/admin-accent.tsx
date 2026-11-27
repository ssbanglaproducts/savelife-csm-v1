"use client";

import { useEffect } from "react";

/**
 * Applies the admin palette to the root element so shared portals (dialogs,
 * menus, toasts) inherit it too. The class is removed when the admin layout
 * unmounts, keeping the storefront and member panel on the green palette.
 */
export function AdminAccent() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("admin-accent");
    return () => {
      root.classList.remove("admin-accent");
    };
  }, []);

  return null;
}
