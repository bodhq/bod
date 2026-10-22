"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Suspense, useId } from "react";
import { useForm } from "react-hook-form";

import { useAuth } from "@/core/auth/hooks/useAuth";
import { useLoginError } from "@/core/auth/hooks/useLoginError";
import { type LoginFormData, loginSchema } from "@/core/auth/validations";
import { Button } from "@/core/ui/Button";
import { Input } from "@/core/ui/Input";
import { Label } from "@/core/ui/Label";
import { LoginBackground } from "@/core/ui/LoginBackground";
import { Logo } from "@/core/ui/Logo";
import { ThemeToggle } from "@/core/ui/ThemeToggle";

export default function LoginPage() {
  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-(--color-background) p-4 text-(--color-foreground) sm:p-8">
      <LoginBackground />
      <ThemeToggle className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20" />

      <main className="relative z-10 w-full max-w-sm">
        <section className="rounded-2xl border border-(--color-border) bg-(--color-surface-100) p-8 sm:p-10">
          <header className="mb-8 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">Přihlášení</h1>
            <p className="mt-2 text-sm text-(--color-muted-foreground)">
              Jsme rádi, že vás znovu vidíme.
            </p>
          </header>

          <Suspense
            fallback={
              <div
                className="flex h-52 items-center justify-center"
                role="status"
                aria-label="Načítání"
              >
                <div className="size-6 animate-spin rounded-full border-2 border-(--color-primary) border-t-transparent" />
              </div>
            }
          >
            <LoginForm />
          </Suspense>
        </section>
        <footer className="absolute top-full left-0 right-0 mt-5 flex items-center justify-center gap-2 text-center">
          <span className="text-xs text-(--color-muted-foreground)">Vytvořeno systémem</span>
          <Logo className="h-4 w-auto text-(--color-muted-foreground)" />
        </footer>
      </main>
    </div>
  );
}

function LoginForm() {
  useLoginError();
  const { loginAsync, error: authError } = useAuth();
  const formId = useId();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      await loginAsync(data.username, data.password);
    } catch {
      // Error is handled in useAuth hook
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {authError && (
        <p id={`${formId}-auth-error`} className="text-sm text-(--color-destructive)" role="alert">
          {authError}
        </p>
      )}

      <fieldset disabled={isSubmitting} className="flex flex-col gap-6 disabled:opacity-70">
        <div className="flex flex-col gap-5">
          <div>
            <Label htmlFor={`${formId}-username`} className="mb-2 block">
              Uživatelské jméno
            </Label>
            <Input
              id={`${formId}-username`}
              aria-invalid={!!errors.username}
              aria-describedby={errors.username ? `${formId}-username-error` : undefined}
              error={!!errors.username}
              autoComplete="username"
              {...register("username")}
            />
            {errors.username && (
              <p
                id={`${formId}-username-error`}
                className="mt-1.5 text-sm text-(--color-destructive)"
              >
                Zadejte platné uživatelské jméno.
              </p>
            )}
          </div>

          <div>
            <Label htmlFor={`${formId}-password`} className="mb-2 block">
              Heslo
            </Label>
            <Input
              id={`${formId}-password`}
              type="password"
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? `${formId}-password-error` : undefined}
              error={!!errors.password}
              autoComplete="current-password"
              {...register("password")}
            />
            {errors.password && (
              <p
                id={`${formId}-password-error`}
                className="mt-1.5 text-sm text-(--color-destructive)"
              >
                Zadejte heslo.
              </p>
            )}
          </div>
        </div>

        <Button type="submit" variant="default" className="w-full" isLoading={isSubmitting}>
          Přihlásit se
        </Button>
      </fieldset>
    </form>
  );
}
