"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Pencil, Trash2, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { memberFieldClass, memberInputClass, memberLabelClass } from "./form-styles";

export type NomineeView = {
  id: string;
  fullName: string;
  relation: string;
  phone: string;
};

type FormState = { fullName: string; relation: string; phone: string };

const emptyForm: FormState = { fullName: "", relation: "", phone: "" };

export function NomineeManager({ initialNominees }: { initialNominees: NomineeView[] }) {
  const tm = useTranslations("memberPanel");
  const tc = useTranslations("common");
  const [nominees, setNominees] = useState(initialNominees);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const response = await fetch("/api/member/nominees", { cache: "no-store" });
    if (response.ok) {
      const data = (await response.json()) as { nominees: NomineeView[] };
      setNominees(data.nominees);
    }
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
    setError(null);
  }

  function openEdit(nominee: NomineeView) {
    setEditingId(nominee.id);
    setForm({ fullName: nominee.fullName, relation: nominee.relation, phone: nominee.phone });
    setShowForm(true);
    setError(null);
  }

  async function save() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(
        editingId ? `/api/member/nominees/${editingId}` : "/api/member/nominees",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        },
      );
      if (!response.ok) {
        const message = tc("error");
        setError(message);
        toast.error(message);
        return;
      }
      await load();
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      toast.success(tm("nomineeSaved"));
    } catch {
      const message = tc("error");
      setError(message);
      toast.error(message);
    } finally {
      setPending(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm(tm("confirmDeleteNominee"))) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/member/nominees/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const message = tc("error");
        setError(message);
        toast.error(message);
        return;
      }
      await load();
      toast.success(tm("nomineeDeleted"));
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
          <h2 className="font-display text-lg font-bold">{tm("nomineesTitle")}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{tm("nomineesIntro")}</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={openCreate}>
          {tm("addNominee")}
        </Button>
      </div>

      {showForm ? (
        <div className="mt-6 space-y-4 rounded-2xl border border-border bg-background/40 p-4">
          <p className="font-display font-bold">{editingId ? tm("editNominee") : tm("nomineeFormTitle")}</p>
          <div className={memberFieldClass}>
            <label className={memberLabelClass} htmlFor="nominee-name">{tm("nomineeName")}</label>
            <input
              id="nominee-name"
              className={`${memberInputClass} mt-2`}
              minLength={2}
              maxLength={120}
              value={form.fullName}
              onChange={(event) => setForm({ ...form, fullName: event.target.value })}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className={memberFieldClass}>
              <label className={memberLabelClass} htmlFor="nominee-relation">{tm("nomineeRelation")}</label>
              <input
                id="nominee-relation"
                className={`${memberInputClass} mt-2`}
                maxLength={80}
                value={form.relation}
                onChange={(event) => setForm({ ...form, relation: event.target.value })}
              />
            </div>
            <div className={memberFieldClass}>
              <label className={memberLabelClass} htmlFor="nominee-phone">{tm("nomineePhone")}</label>
              <input
                id="nominee-phone"
                inputMode="tel"
                className={`${memberInputClass} mt-2`}
                minLength={8}
                maxLength={30}
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              size="sm"
              disabled={
                pending ||
                form.fullName.trim().length < 2 ||
                !form.relation.trim() ||
                form.phone.trim().length < 8
              }
              onClick={() => void save()}
            >
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              {tc("save")}
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

      {nominees.length === 0 ? (
        <p className="mt-6 flex items-center gap-2 rounded-xl border border-border bg-background/40 p-4 text-sm text-muted-foreground">
          <UsersRound className="size-4 text-primary" aria-hidden="true" />
          {tm("noNominees")}
        </p>
      ) : (
        <ul className="mt-6 grid gap-3">
          {nominees.map((nominee) => (
            <li
              key={nominee.id}
              className="flex flex-col gap-3 rounded-2xl border border-border bg-background/40 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-display font-bold" translate="no">{nominee.fullName}</p>
                <p className="mt-1 text-sm text-muted-foreground" translate="no">
                  {nominee.relation} · {nominee.phone}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => openEdit(nominee)}>
                  <Pencil className="size-4" aria-hidden="true" />
                  {tm("editNominee")}
                </Button>
                <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => void remove(nominee.id)}>
                  <Trash2 className="size-4" aria-hidden="true" />
                  {tm("deleteNominee")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
