"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { m } from "framer-motion";
import { Lock, User } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useEffect, useId, useState } from "react";
import { useForm } from "react-hook-form";
import { useAuth } from "@/core/auth/hooks/useAuth";
import { type LoginFormData, loginSchema } from "@/core/auth/validations";
import { Text } from "@/core/ui/Text";
import { Alert } from "@/core/ui/Alert";
import { Button } from "@/core/ui/Button";
import { Input } from "@/core/ui/Input";
import { KineticBackground } from "@/core/ui/KineticBackground";
import { Label } from "@/core/ui/Label";
import { Logo } from "@/core/ui/Logo";

export default function LoginPage() {
  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-(--color-primary) p-4 sm:p-8">
      {/* Full-screen Kinetic Background */}
      <KineticBackground />

      {/* Centered Content */}
      <div className="relative z-10 w-full max-w-lg flex flex-col items-center">
        {/* Premium Login Card respecting the original design language */}
        <m.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", bounce: 0, duration: 0.6 }}
          className="w-full rounded-[2rem] bg-(--color-surface-100) p-8 sm:p-12 shadow-2xl shadow-black/20 dark:shadow-black/50 border border-black/10 dark:border-white/10 relative overflow-hidden"
        >
          <div className="relative z-10 mb-8 flex flex-col items-center text-center">
            <Logo className="h-10 sm:h-12 w-auto text-(--color-text-primary) mb-6 drop-shadow-sm" />
            <Text variant="h1" className="mb-2">
              Vítejte zpět!
            </Text>
            <Text variant="muted">
              Jsme rádi, že vás znovu vidíme.
            </Text>
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
        </m.div>
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
      setError("Vaše relace vypršela nebo byla ukončena. Přihlaste se prosím znovu.");
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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 relative z-10">
      {(authError || error || Object.keys(errors).length > 0) && (
        <Alert variant="destructive">
          {authError || error || "Neplatné přihlašovací údaje."}
        </Alert>
      )}

      <fieldset
        disabled={isSubmitting}
        className="space-y-6 disabled:opacity-70 group"
      >
        <div className="space-y-2">
          <Label
            htmlFor={`${formId}-username`}
            className="flex items-center gap-2 relative z-10"
          >
            <User className="w-4 h-4 text-(--color-brand-text)" />
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
            {...register("username")}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label
              htmlFor={`${formId}-password`}
              className="flex items-center gap-2 relative z-10"
            >
              <Lock className="w-4 h-4 text-(--color-brand-text)" />
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

          <div className="pt-1">
            <a
              href="#"
              className="text-xs font-medium text-(--color-brand-text) hover:underline transition-all"
            >
              Zapomněli jste heslo?
            </a>
          </div>
        </div>

        <Button type="submit" className="w-full mt-8" isLoading={isSubmitting}>
          Přihlásit se
        </Button>
      </fieldset>
    </form>
  );
}
