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
import { type LoginFormData, loginSchema } from "@/core/validations";

export default function LoginPage() {
  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-(--color-primary) p-4 sm:p-8">
      {/* Full-screen Kinetic Background */}
      <KineticBackground />

      {/* Centered Content */}
      <div className="relative z-10 w-full max-w-lg flex flex-col items-center">
        {/* Premium Login Card respecting the original design language */}
        <div className="w-full rounded-3xl bg-(--color-background)/95 p-6 shadow-2xl backdrop-blur-xl ring-1 ring-white/10 dark:ring-white/5 sm:rounded-[2.5rem] sm:p-12 animate-in fade-in zoom-in-95 slide-in-from-bottom-8 duration-700 ease-out fill-mode-both">
          <div className="mb-8 sm:mb-10 flex flex-col items-center">
            <Logo className="h-10 sm:h-12 w-auto text-(--color-foreground) mb-4 sm:mb-6 drop-shadow-sm transition-transform duration-500 hover:scale-105" />
            <h1 className="text-2xl font-extrabold tracking-tighter text-center text-(--color-foreground) sm:text-4xl mb-2 sm:mb-3">
              Vstupte do systému
            </h1>
            <p className="text-sm sm:text-base text-center text-(--color-muted-foreground) max-w-[280px]">
              Zadejte své přihlašovací údaje pro zabezpečený přístup.
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
      username: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      await loginAsync(data.username, data.password);
    } catch {
      // Error handled in useAuth
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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
            htmlFor={`${formId}-username`}
            className="flex items-center gap-2 font-medium"
          >
            <User className="w-4 h-4 text-(--color-muted-foreground)" />
            Uživatelské jméno
          </Label>
          <Input
            id={`${formId}-username`}
            type="text"
            placeholder="admin"
            aria-invalid={!!errors.username}
            aria-describedby={
              errors.username ? `${formId}-username-error` : undefined
            }
            error={!!errors.username}
            autoComplete="username"
            size="lg"
            {...register("username")}
          />
          {errors.username && (
            <p
              id={`${formId}-username-error`}
              className="text-xs font-medium text-(--color-destructive) ml-1 animate-in fade-in slide-in-from-top-1"
              role="alert"
            >
              {errors.username.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label
              htmlFor={`${formId}-password`}
              className="flex items-center gap-2 font-medium"
            >
              <Lock className="w-4 h-4 text-(--color-muted-foreground)" />
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
            size="lg"
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
          className="w-full mt-4"
          size="lg"
          isLoading={isSubmitting}
        >
          Přihlásit se
        </Button>
      </fieldset>
    </form>
  );
}
