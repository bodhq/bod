"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Lock, User } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useEffect, useId, useState } from "react";
import { useForm } from "react-hook-form";
import { useAuth } from "@/core/auth/hooks/useAuth";
import { Alert } from "@/core/ui/Alert";
import { Button } from "@/core/ui/Button";
import { Input } from "@/core/ui/Input";
import { KineticBackground } from "@/core/ui/KineticBackground";
import { Label } from "@/core/ui/Label";
import { Logo } from "@/core/ui/Logo";
import { type LoginFormData, loginSchema } from "@/core/auth/validations";

export default function LoginPage() {
  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-(--color-primary) p-4 sm:p-8">
      {/* Full-screen Kinetic Background */}
      <KineticBackground />

      {/* Centered Content */}
      <div className="relative z-10 w-full max-w-lg flex flex-col items-center">
        {/* Premium Login Card respecting the original design language */}
        <div className="w-full rounded-2xl bg-(--color-surface) p-8 sm:p-10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] ring-1 ring-black/10 dark:ring-white/10 relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out fill-mode-both">
          {/* Subtle grid pattern overlay - PLACED BEHIND CONTENT WITH NO POINTER EVENTS */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

          <div className="relative z-10 mb-8 sm:mb-10 flex flex-col items-start border-b-2 border-black/10 dark:border-white/10 pb-6 text-left">
            <Logo className="h-8 sm:h-10 w-auto text-(--color-foreground) mb-6 drop-shadow-sm" />
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-(--color-foreground) mb-2">
              Vítejte zpět
            </h1>
            <p className="text-sm text-(--color-muted-foreground) max-w-[300px]">
              Přihlaste se ke svému účtu pro přístup do informačního systému.
            </p>
          </div>

          <React.Suspense
            fallback={
              <div className="h-64 flex items-center justify-center">
                <div className="animate-spin h-6 w-6 border-2 border-(--color-primary) border-t-transparent rounded-full" />
              </div>
            }
          >
            <LoginForm />
          </React.Suspense>
        </div>
      </div>
    </div>
  );
}

function LoginForm() {
  const _router = useRouter();
  const searchParams = useSearchParams();
  const { loginAsync, error: authError } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const formId = useId();

  // Získání chybové hlášky z URL (např. po redirectu z middleware)
  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (errorParam === "unauthorized") {
      setError("Pro přístup k této stránce se musíte přihlásit.");
    }
  }, [searchParams]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      await loginAsync(data.email, data.password);
    } catch {
      // Error handled in useAuth
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 relative z-10">
      {(authError || error) && (
        <Alert
          variant="destructive"
          className="animate-in fade-in slide-in-from-top-2 duration-300"
        >
          {authError || error}
        </Alert>
      )}

      <fieldset
        disabled={isSubmitting}
        className="space-y-6 disabled:opacity-70 group"
      >
        <div className="space-y-2">
            <Label
              htmlFor={`${formId}-email`}
              className="flex items-center gap-2 font-medium text-sm relative z-10"
            >
              <User className="w-4 h-4 text-(--color-primary)" />
              E-mail
            </Label>
          <Input
            id={`${formId}-email`}
            type="email"
            placeholder="admin@bod.local"
            aria-invalid={!!errors.email}
            aria-describedby={
              errors.email ? `${formId}-email-error` : undefined
            }
            error={!!errors.email}
            autoComplete="email"
            {...register("email")}
          />
          {errors.email && (
            <p
              id={`${formId}-email-error`}
              className="text-xs font-medium text-(--color-destructive) ml-1 animate-in fade-in slide-in-from-top-1"
              role="alert"
            >
              {errors.email.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label
              htmlFor={`${formId}-password`}
              className="flex items-center gap-2 font-medium text-sm relative z-10"
            >
              <Lock className="w-4 h-4 text-(--color-primary)" />
              Heslo
            </Label>
          </div>
          <Input
            id={`${formId}-password`}
            type="password"
            placeholder="••••••••"
            aria-invalid={!!errors.password}
            aria-describedby={
              errors.password ? `${formId}-password-error` : undefined
            }
            error={!!errors.password}
            autoComplete="current-password"
            {...register("password")}
          />
          {errors.password && (
            <p
              id={`${formId}-password-error`}
              className="text-xs font-medium text-(--color-destructive) ml-1 animate-in fade-in slide-in-from-top-1"
              role="alert"
            >
              {errors.password.message}
            </p>
          )}
        </div>

        <Button
          type="submit"
          className="w-full mt-8"
          isLoading={isSubmitting}
        >
          Přihlásit se
        </Button>
      </fieldset>
    </form>
  );
}
