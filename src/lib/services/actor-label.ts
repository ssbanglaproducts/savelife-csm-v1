export type ActorLabelSource = {
  name?: string | null;
  fullName?: string | null;
  memberId?: string | null;
  email?: string | null;
} | null | undefined;

/**
 * Human-readable audit/plan actor label. Admin and staff identities may have
 * no Member ID, so fall back to their email and finally their name.
 */
export function formatActorLabel(actor: ActorLabelSource): string {
  if (!actor) return "—";
  const name = actor.name ?? actor.fullName ?? "";
  const detail = actor.memberId ?? actor.email ?? null;
  if (name && detail && name !== detail) return `${name} (${detail})`;
  return name || detail || "—";
}
