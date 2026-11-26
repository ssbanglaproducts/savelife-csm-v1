/** Why an operation was intentionally skipped (never an error). */
export type NoOpReason =
  | "DUPLICATE"
  | "ALREADY_APPLIED"
  | "NOT_DUE"
  | "NOT_MATURED"
  | "BELOW_MINIMUM"
  | "INSUFFICIENT_BALANCE"
  | "NOT_FOUND"
  | "INELIGIBLE";

/** Result of a single-entity operation. */
export type OperationResult =
  | { readonly applied: true; readonly ledgerEntryIds: readonly string[] }
  | {
      readonly applied: false;
      readonly reason: NoOpReason;
      readonly ledgerEntryIds: readonly string[];
    };

/** Result of an operation that processes several entities independently. */
export interface BatchOperationResult {
  readonly appliedIds: readonly string[];
  readonly skippedIds: readonly string[];
  readonly skippedReasons: Readonly<Record<string, NoOpReason>>;
  readonly ledgerEntryIds: readonly string[];
}
