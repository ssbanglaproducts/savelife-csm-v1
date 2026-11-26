"use client";

import { useId, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { AuthShell } from "@/components/layout/auth-shell";
import { Button } from "@/components/ui/button";
import { Link, useRouter } from "@/i18n/navigation";

type SessionResponse = {
  user?: {
    role?: string;
  } | null;
};

export default function LoginPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const fieldId = useId();
  const errorId = `${fieldId}-error`;

  const [memberId, setMemberId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const queryClient = useQueryClient();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const result = await signIn("credentials", {
      memberId: memberId.trim(),
      password,
      redirect: false,
    });

    if (result?.error) {
      setPending(false);
      setError(t("invalidCredentials"));
      return;
    }

    let isAdmin = false;
    try {
      const response = await fetch("/api/auth/session", { cache: "no-store" });
      const session = (await response.json()) as SessionResponse;
      isAdmin = session.user?.role === "ADMIN";
    } catch {
      // The session cookie is already set; the member dashboard remains safe.
    }

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["viewer"] }),
      queryClient.invalidateQueries({ queryKey: ["cart-count"] }),
      queryClient.invalidateQueries({ queryKey: ["notifications"] }),
    ]);

    router.replace(isAdmin ? "/admin/dashboard" : "/member/dashboard");
  }

  const inputClass =
    "h-12 min-w-0 w-full rounded-xl border border-border bg-[var(--glass-strong)] px-4 text-sm text-foreground placeholder:text-muted-foreground/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

  return (
    <AuthShell>
      <div className="animate-rise">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          {t("loginTitle")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("loginSubtitle")}</p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate={false}>
          <div className="space-y-2">
            <label htmlFor={`${fieldId}-member-id`} className="block text-sm font-semibold">
              {t("memberId")}
            </label>
            <input
              id={`${fieldId}-member-id`}
              type="text"
              name="memberId"
              required
              value={memberId}
              onChange={(event) => setMemberId(event.target.value)}
              autoComplete="username"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder={t("memberIdPlaceholder")}
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

          <div className="flex justify-end">
            <Link
              href="/forgot-password"
              className="rounded-md text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t("forgotPassword")}
            </Link>
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
          {t("noAccount")}{" "}
          <Link href="/register" className="font-semibold text-primary hover:underline">
            {t("signUp")}
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
