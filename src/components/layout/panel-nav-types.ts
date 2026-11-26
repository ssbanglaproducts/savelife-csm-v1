export type PanelNavBadge = {
  count: number;
  label: string;
  tone?: "primary" | "warning";
};

export type PanelLink = {
  href: string;
  label: string;
  locked?: boolean;
  /** Optional heading used by the desktop panel navigation. */
  group?: string;
  /** Unread or pending indicator shown in panel navigation. */
  badge?: PanelNavBadge;
  /** Nested navigation entries rendered as an expandable desktop group. */
  children?: PanelLink[];
  /** Accessible label for the desktop expand/collapse control. */
  toggleLabel?: string;
};
