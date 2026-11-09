"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Suspense, useId } from "react";
import { useForm } from "react-hook-form";

import { ThemeToggle } from "@/core/appearance/ThemeToggle";
import { useAuth } from "@/core/auth/hooks/useAuth";
import { useLoginError } from "@/core/auth/hooks/useLoginError";
import { type LoginFormData, loginSchema } from "@/core/auth/validations";
import { Button } from "@/core/ui/actions/Button";
import { Logo } from "@/core/ui/brand/Logo";
import { Input } from "@/core/ui/forms/Input";

import "../login.css";

export default function LoginView() {
  return (
    <div className="login-view relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-(--color-background) p-4 text-(--color-foreground) sm:p-8">
      <div className="login-pattern" aria-hidden="true">
        <div className="login-pattern__tiles" />
      </div>
      <ThemeToggle className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20" />

      <main className="relative z-10 w-full max-w-sm">
        <section className="rounded-2xl border border-(--color-border) bg-(--color-surface-100) p-8 sm:p-10">
          <header className="mb-8 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">Přihlášení</h1>
            <p className="mt-2 text-sm text-(--color-muted-foreground)">
              Přihlaste se svým školním účtem.
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
          <Input
            id={`${formId}-username`}
            label="Uživatelské jméno"
            error={errors.username ? "Zadejte platné uživatelské jméno." : undefined}
            autoComplete="username"
            {...register("username")}
          />
          <Input
            id={`${formId}-password`}
            label="Heslo"
            type="password"
            error={errors.password ? "Zadejte heslo." : undefined}
            autoComplete="current-password"
            {...register("password")}
          />
        </div>

        <Button type="submit" variant="default" className="w-full" isLoading={isSubmitting}>
          Přihlásit se
        </Button>
      </fieldset>
    </form>
  );
}
