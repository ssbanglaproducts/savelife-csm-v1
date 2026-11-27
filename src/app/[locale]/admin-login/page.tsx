"use client";

import { useId, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { AuthShell } from "@/components/layout/auth-shell";
import { Button } from "@/components/ui/button";
import { Link, useRouter } from "@/i18n/navigation";

export default function AdminLoginPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const fieldId = useId();
  const errorId = `${fieldId}-error`;
  const queryClient = useQueryClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const result = await signIn("credentials", {
      email: email.trim(),
      password,
      expectedRole: "ADMIN",
      redirect: false,
    });

    if (result?.error) {
      setPending(false);
      setError(t("invalidCredentials"));
      return;
    }

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["viewer"] }),
      queryClient.invalidateQueries({ queryKey: ["cart-count"] }),
      queryClient.invalidateQueries({ queryKey: ["notifications"] }),
    ]);

    router.replace("/admin/dashboard");
  }

  const inputClass =
    "h-12 min-w-0 w-full rounded-xl border border-border bg-[var(--glass-strong)] px-4 text-sm text-foreground placeholder:text-muted-foreground/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

  return (
    <AuthShell>
      <div className="animate-rise">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
          <ShieldCheck className="size-4" aria-hidden="true" />
          {t("adminAccessOnly")}
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          {t("adminLoginTitle")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("adminLoginSubtitle")}</p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate={false}>
          <div className="space-y-2">
            <label htmlFor={`${fieldId}-email`} className="block text-sm font-semibold">
              {t("email")}
            </label>
            <input
              id={`${fieldId}-email`}
              type="email"
              name="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="username"
              spellCheck={false}
              placeholder={t("adminEmailPlaceholder")}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              className={inputClass}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor={`${fieldId}-password`} className="block text-sm font-semibold">
              {t("password")}
            </label>
            <div className="relative">
              <input
                id={`${fieldId}-password`}
                type={showPassword ? "text" : "password"}
                name="password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                spellCheck={false}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
                className={`${inputClass} pr-12`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? t("hidePassword") : t("showPassword")}
                className="absolute right-1.5 top-1.5 flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {showPassword ? (
                  <EyeOff className="size-4" aria-hidden="true" />
                ) : (
                  <Eye className="size-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          {error ? (
            <p
              id={errorId}
              role="alert"
              aria-live="polite"
              className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300"
            >
              {error}
            </p>
          ) : null}

          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                {t("signingIn")}
              </>
            ) : (
              t("loginButton")
            )}
          </Button>
        </form>

        <p className="mt-7 text-center text-sm text-muted-foreground">
          <Link href="/login" className="font-semibold text-primary hover:underline">
            {t("memberLoginLink")}
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
