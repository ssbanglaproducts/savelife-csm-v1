"use client";

import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, MapPin, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";
import type { Viewer } from "@/lib/viewer";

export type AddressDTO = {
  id: string;
  label: string | null;
  fullName: string | null;
  phone: string | null;
  street: string;
  thana: string | null;
  district: string | null;
  postalCode: string | null;
  isMain: boolean;
};

const addressLabels = ["HOME", "OFFICE", "PERSONAL", "OTHER"] as const;
type AddressLabel = (typeof addressLabels)[number];

/**
 * Shared saved-address selector: shows the read-only account identity at the
 * top, then lets the member select an existing address or add a new one.
 */
export function AddressPicker({
  viewer,
  selectedId,
  onSelect,
  disabled = false,
}: {
  viewer: Viewer;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("purchase");
  const tc = useTranslations("common");
  const uid = useId();
  const [addresses, setAddresses] = useState<AddressDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState<AddressLabel>("HOME");
  const [fullAddress, setFullAddress] = useState("");
  const [thana, setThana] = useState("");
  const [district, setDistrict] = useState("");
  const [useAsMain, setUseAsMain] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/member/addresses", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : { addresses: [] }))
      .then((data: { addresses?: AddressDTO[] }) => {
        if (!active) return;
        const list = data.addresses ?? [];
        setAddresses(list);
        if (selectedId === null && list.length > 0) onSelect(list[0].id);
        // Signup no longer collects an address. Open the add form immediately
        // so an active buyer with no saved address is prompted to enter one.
        if (list.length === 0) setAdding(true);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // Only fetch once on mount; selection is controlled by the parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function labelText(value: string | null) {
    const key = value?.toLowerCase();
    if (key && (addressLabels as readonly string[]).includes(key)) {
      return t(`label${key!.charAt(0).toUpperCase()}${key!.slice(1)}` as "labelHome");
    }
    return value || t("labelOther");
  }

  async function saveAddress() {
    setSaving(true);
    try {
      const response = await fetch("/api/member/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label,
          fullAddress,
          thana,
          district,
          isMain: useAsMain,
        }),
      });
      if (!response.ok) throw new Error("ADDRESS_FAILED");
      const data = (await response.json()) as { address: AddressDTO };
      setAddresses((current) => [
        data.address,
        ...current.map((address) => (useAsMain ? { ...address, isMain: false } : address)),
      ]);
      onSelect(data.address.id);
      setAdding(false);
      setFullAddress("");
      setThana("");
      setDistrict("");
      setUseAsMain(false);
      toast.success(t("saveAddress"));
    } catch {
      toast.error(tc("error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-border bg-[var(--glass)] p-3">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          {t("accountTitle")}
        </p>
        <div className="flex items-center gap-3">
          <UserAvatar name={viewer.name} src={viewer.image} className="size-11 rounded-full" />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{viewer.name}</p>
            <p className="truncate text-xs text-muted-foreground" dir="ltr">
              {viewer.phone ?? "—"}
            </p>
          </div>
        </div>
      </section>

      <section>
        <h3 className="font-display text-sm font-bold">{t("selectAddress")}</h3>
        <div className="mt-3 space-y-2">
          {loading ? (
            <p className="text-xs text-muted-foreground">{tc("loading")}</p>
          ) : null}
          {!loading && addresses.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("noAddresses")}</p>
          ) : null}
          {addresses.map((address) => {
            const selected = selectedId === address.id;
            return (
              <button
                key={address.id}
                type="button"
                disabled={disabled}
                aria-pressed={selected}
                onClick={() => onSelect(address.id)}
                className={`w-full rounded-2xl border p-3 text-left transition-colors disabled:opacity-60 ${
                  selected
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-sm font-bold">
                    <MapPin className="size-3.5 text-primary" aria-hidden="true" />
                    {labelText(address.label)}
                  </span>
                  {address.isMain ? (
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                      {t("mainAddress")}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  {address.street}, {address.thana}, {address.district}
                </p>
                {selected ? (
                  <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-primary">
                    <Check className="size-3" aria-hidden="true" /> {t("selected")}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-border p-4">
        <button
          type="button"
          onClick={() => setAdding((value) => !value)}
          aria-expanded={adding}
          disabled={disabled}
          className="inline-flex items-center gap-2 text-sm font-bold text-primary disabled:opacity-60"
        >
          <Plus className="size-4" aria-hidden="true" />
          {t("addAddress")}
        </button>
        {adding ? (
          <div className="mt-4 space-y-3">
            <div>
              <label className="block text-xs font-semibold" htmlFor={`address-label-${uid}`}>
                {t("addressLabel")}
              </label>
              <select
                id={`address-label-${uid}`}
                value={label}
                onChange={(event) => setLabel(event.target.value as AddressLabel)}
                className="mt-1.5 h-11 w-full rounded-xl border border-border bg-[var(--card-solid)] px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {addressLabels.map((value) => (
                  <option key={value} value={value}>
                    {t(`label${value.charAt(0)}${value.slice(1).toLowerCase()}` as "labelHome")}
                  </option>
                ))}
              </select>
            </div>
            {[
              { id: "full", label: t("fullAddress"), value: fullAddress, set: setFullAddress },
              { id: "thana", label: t("thana"), value: thana, set: setThana },
              { id: "district", label: t("district"), value: district, set: setDistrict },
            ].map((field) => (
              <div key={field.id}>
                <label className="block text-xs font-semibold" htmlFor={`address-${field.id}-${uid}`}>
                  {field.label}
                </label>
                <input
                  id={`address-${field.id}-${uid}`}
                  value={field.value}
                  onChange={(event) => field.set(event.target.value)}
                  className="mt-1.5 h-11 w-full rounded-xl border border-border bg-[var(--card-solid)] px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            ))}
            <label className="flex items-center gap-2 text-xs font-semibold">
              <input
                type="checkbox"
                checked={useAsMain}
                onChange={(event) => setUseAsMain(event.target.checked)}
              />
              {t("useAsMain")}
            </label>
            <Button
              type="button"
              variant="outline"
              onClick={saveAddress}
              disabled={saving || !fullAddress || !thana || !district}
              className="w-full"
            >
              {saving ? tc("saving") : t("saveAddress")}
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
