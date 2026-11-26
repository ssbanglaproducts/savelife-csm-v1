"use client";

import { useId, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { adminInputClass, adminLabelClass } from "./admin-ui";

type Kind = "ANNOUNCEMENT" | "NOTICE" | "ALERT";

export function AnnouncementsForm() {
  const t = useTranslations("notifications");
  const tc = useTranslations("common");
  const router = useRouter();
  const fieldId = useId();
  const [kind, setKind] = useState<Kind>("ANNOUNCEMENT");
  const [titleEn, setTitleEn] = useState("");
  const [titleBn, setTitleBn] = useState("");
  const [bodyEn, setBodyEn] = useState("");
  const [bodyBn, setBodyBn] = useState("");
  const [href, setHref] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          kind,
          title: { en: titleEn, bn: titleBn },
          body: { en: bodyEn, bn: bodyBn },
          href: href.trim() || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        const message = data.error === "INVALID_NOTIFICATION" ? t("invalidLink") : tc("error");
        setError(message);
        toast.error(message);
        return;
      }
      toast.success(t("published"));
      setTitleEn("");
      setTitleBn("");
      setBodyEn("");
      setBodyBn("");
      setHref("");
      router.refresh();
    } catch {
      const message = tc("error");
      setError(message);
      toast.error(message);
    } finally {
      setPending(false);
    }
  }

  const inputClass = `${adminInputClass} mt-2`;

  if (!showForm) {
    return (
      <div className="flex justify-end">
        <Button type="button" onClick={() => setShowForm(true)}>
          {t("createTitle")}
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background/95 p-4 backdrop-blur sm:static sm:bg-transparent sm:p-0">
      <form onSubmit={handleSubmit} className="glass rounded-2xl p-5 sm:p-6">
      <h3 className="font-display text-lg font-bold">{t("createTitle")}</h3>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${fieldId}-kind`} className={adminLabelClass}>
            {t("kind")}
          </label>
          <select
            id={`${fieldId}-kind`}
            value={kind}
            onChange={(event) => setKind(event.target.value as Kind)}
            className={inputClass}
          >
            <option value="ANNOUNCEMENT">{t("kinds.ANNOUNCEMENT")}</option>
            <option value="NOTICE">{t("kinds.NOTICE")}</option>
            <option value="ALERT">{t("kinds.ALERT")}</option>
          </select>
        </div>
        <div>
          <label htmlFor={`${fieldId}-audience`} className={adminLabelClass}>
            {t("audience")}
          </label>
          <input
            id={`${fieldId}-audience`}
            value={t("allMembers")}
            readOnly
            className={`${inputClass} opacity-70`}
          />
        </div>
        <div>
          <label htmlFor={`${fieldId}-title-en`} className={adminLabelClass}>
            {t("titleEn")}
          </label>
          <input
            id={`${fieldId}-title-en`}
            value={titleEn}
            onChange={(event) => setTitleEn(event.target.value)}
            maxLength={180}
            required
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor={`${fieldId}-title-bn`} className={adminLabelClass}>
            {t("titleBn")}
          </label>
          <input
            id={`${fieldId}-title-bn`}
            value={titleBn}
            onChange={(event) => setTitleBn(event.target.value)}
            maxLength={180}
            required
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor={`${fieldId}-body-en`} className={adminLabelClass}>
            {t("bodyEn")}
          </label>
          <textarea
            id={`${fieldId}-body-en`}
            value={bodyEn}
            onChange={(event) => setBodyEn(event.target.value)}
            maxLength={500}
            rows={3}
            required
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor={`${fieldId}-body-bn`} className={adminLabelClass}>
            {t("bodyBn")}
          </label>
          <textarea
            id={`${fieldId}-body-bn`}
            value={bodyBn}
            onChange={(event) => setBodyBn(event.target.value)}
            maxLength={500}
            rows={3}
            required
            className={inputClass}
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor={`${fieldId}-href`} className={adminLabelClass}>
            {t("link")}
          </label>
          <input
            id={`${fieldId}-href`}
            value={href}
            onChange={(event) => setHref(event.target.value)}
            placeholder="/member/wallet"
            maxLength={200}
            className={inputClass}
          />
        </div>
      </div>
      {error ? <p className="mt-3 text-xs text-destructive">{error}</p> : null}
      <div className="mt-5 flex flex-wrap gap-2">
        <Button type="submit" disabled={pending} className="gap-2">
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
          {pending ? t("publishing") : t("publish")}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
          {tc("cancel")}
        </Button>
      </div>
    </form>
    </div>
  );
}
