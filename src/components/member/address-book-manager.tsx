"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, MapPin, Pencil, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { memberFieldClass, memberInputClass, memberLabelClass } from "./form-styles";

export type AddressView = {
  id: string;
  label: string | null;
  fullName: string;
  phone: string;
  street: string;
  thana: string;
  district: string;
  postalCode: string | null;
  isMain: boolean;
};

type FormState = {
  label: string;
  fullAddress: string;
  thana: string;
  district: string;
  postalCode: string;
  isMain: boolean;
};

const emptyForm: FormState = {
  label: "HOME",
  fullAddress: "",
  thana: "",
  district: "",
  postalCode: "",
  isMain: false,
};

export function AddressBookManager({
  initialAddresses,
  canManage,
}: {
  initialAddresses: AddressView[];
  canManage: boolean;
}) {
  const tm = useTranslations("memberPanel");
  const tp = useTranslations("purchase");
  const tc = useTranslations("common");
  const [addresses, setAddresses] = useState(initialAddresses);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function messageFor(code?: string) {
    if (code === "MEMBER_NOT_ACTIVE") return tm("addressBookLocked");
    return tc("error");
  }

  async function load() {
    const response = await fetch("/api/member/addresses", { cache: "no-store" });
    if (response.ok) {
      const data = (await response.json()) as { addresses: AddressView[] };
      setAddresses(data.addresses);
    }
  }

  function openCreate() {
    setEditingId(null);
    setForm({ ...emptyForm, isMain: addresses.length === 0 });
    setShowForm(true);
    setError(null);
  }

  function openEdit(address: AddressView) {
    setEditingId(address.id);
    setForm({
      label: address.label ?? "OTHER",
      fullAddress: address.street,
      thana: address.thana,
      district: address.district,
      postalCode: address.postalCode ?? "",
      isMain: address.isMain,
    });
    setShowForm(true);
    setError(null);
  }

  async function save() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(
        editingId ? `/api/member/addresses/${editingId}` : "/api/member/addresses",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            editingId
              ? { action: "UPDATE", ...form }
              : form,
          ),
        },
      );
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        const message = messageFor(data.error);
        setError(message);
        toast.error(message);
        return;
      }
      await load();
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      toast.success(tm("addressSaved"));
    } catch {
      const message = tc("error");
      setError(message);
      toast.error(message);
    } finally {
      setPending(false);
    }
  }

  async function setMain(id: string) {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/member/addresses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SET_MAIN" }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        const message = messageFor(data.error);
        setError(message);
        toast.error(message);
        return;
      }
      await load();
      toast.success(tm("addressMainUpdated"));
    } catch {
      setError(tc("error"));
    } finally {
      setPending(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm(tm("confirmDeleteAddress"))) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/member/addresses/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        const message = messageFor(data.error);
        setError(message);
        toast.error(message);
        return;
      }
      await load();
      toast.success(tm("addressDeleted"));
    } catch {
      setError(tc("error"));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="glass min-w-0 rounded-3xl p-6 shadow-xl sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-bold">{tm("addressBookTitle")}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {canManage ? tm("addressBookIntro") : tm("addressBookLocked")}
          </p>
        </div>
        {canManage ? (
          <Button type="button" variant="outline" size="sm" onClick={openCreate}>
            {tm("addAddress")}
          </Button>
        ) : null}
      </div>

      {showForm && canManage ? (
        <div className="mt-6 space-y-4 rounded-2xl border border-border bg-background/40 p-4">
          <p className="font-display font-bold">{editingId ? tm("editAddress") : tm("addAddress")}</p>
          <div className={memberFieldClass}>
            <label className={memberLabelClass} htmlFor="profile-address-label">{tp("addressLabel")}</label>
            <select
              id="profile-address-label"
              className={`${memberInputClass} mt-2`}
              value={form.label}
              onChange={(event) => setForm({ ...form, label: event.target.value })}
            >
              <option value="HOME">{tp("labelHome")}</option>
              <option value="OFFICE">{tp("labelOffice")}</option>
              <option value="PERSONAL">{tp("labelPersonal")}</option>
              <option value="OTHER">{tp("labelOther")}</option>
            </select>
          </div>
          <div className={memberFieldClass}>
            <label className={memberLabelClass} htmlFor="profile-address-full">{tp("fullAddress")}</label>
            <input
              id="profile-address-full"
              className={`${memberInputClass} mt-2`}
              minLength={3}
              maxLength={200}
              value={form.fullAddress}
              onChange={(event) => setForm({ ...form, fullAddress: event.target.value })}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className={memberFieldClass}>
              <label className={memberLabelClass} htmlFor="profile-address-thana">{tp("thana")}</label>
              <input
                id="profile-address-thana"
                className={`${memberInputClass} mt-2`}
                maxLength={80}
                value={form.thana}
                onChange={(event) => setForm({ ...form, thana: event.target.value })}
              />
            </div>
            <div className={memberFieldClass}>
              <label className={memberLabelClass} htmlFor="profile-address-district">{tp("district")}</label>
              <input
                id="profile-address-district"
                className={`${memberInputClass} mt-2`}
                maxLength={80}
                value={form.district}
                onChange={(event) => setForm({ ...form, district: event.target.value })}
              />
            </div>
          </div>
          <div className={memberFieldClass}>
            <label className={memberLabelClass} htmlFor="profile-address-postal">{tp("postalCode")}</label>
            <input
              id="profile-address-postal"
              className={`${memberInputClass} mt-2`}
              maxLength={20}
              value={form.postalCode}
              onChange={(event) => setForm({ ...form, postalCode: event.target.value })}
            />
          </div>
          {canManage ? (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isMain}
                onChange={(event) => setForm({ ...form, isMain: event.target.checked })}
              />
              {tp("useAsMain")}
            </label>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              size="sm"
              disabled={pending || form.fullAddress.trim().length < 3 || !form.thana.trim() || !form.district.trim()}
              onClick={() => void save()}
            >
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              {tp("saveAddress")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
                setError(null);
              }}
            >
              {tc("cancel")}
            </Button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">
          {error}
        </p>
      ) : null}

      {addresses.length === 0 ? (
        <p className="mt-6 rounded-xl border border-border bg-background/40 p-4 text-sm text-muted-foreground">
          {tm("noAddresses")}
        </p>
      ) : (
        <ul className="mt-6 grid gap-3">
          {addresses.map((address) => (
            <li
              key={address.id}
              className="flex flex-col gap-3 rounded-2xl border border-border bg-background/40 p-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm font-bold">
                  <MapPin className="size-4 text-primary" aria-hidden="true" />
                  {address.label ?? tp("labelOther")}
                  {address.isMain ? (
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-bold text-primary">
                      <Star className="mr-1 inline size-3" aria-hidden="true" />
                      {tm("mainAddressBadge")}
                    </span>
                  ) : null}
                </p>
                <p className="mt-2 break-words text-sm text-muted-foreground" translate="no">
                  {[address.street, address.thana, address.district, address.postalCode]
                    .filter(Boolean)
                    .join(", ")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground" translate="no">{address.fullName} · {address.phone}</p>
              </div>
              {canManage ? (
                <div className="flex shrink-0 flex-wrap gap-2">
                  {!address.isMain ? (
                    <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => void setMain(address.id)}>
                      <Star className="size-4" aria-hidden="true" />
                      {tm("setMainAddress")}
                    </Button>
                  ) : null}
                  <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => openEdit(address)}>
                    <Pencil className="size-4" aria-hidden="true" />
                    {tm("editAddress")}
                  </Button>
                  <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => void remove(address.id)}>
                    <Trash2 className="size-4" aria-hidden="true" />
                    {tm("deleteAddress")}
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
