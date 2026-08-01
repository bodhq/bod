import { z } from "zod";

/**
 * Centrální definice všech sdílených validačních pravidel napříč systémem.
 * Jakákoliv změna (např. posílení požadavků na heslo) se automaticky projeví všude.
 */
export const validations = {
  username: z.string().min(1, "Uživatelské jméno je povinné"),

  password: z.string().min(1, "Heslo je povinné"),
  // Zde můžeme do budoucna přidat: .min(8, "Heslo musí mít alespoň 8 znaků")
};

// Sdílená validace specificky pro přihlašovací formulář
export const loginSchema = z.object({
  username: validations.username,
  password: validations.password,
});

export type LoginFormData = z.infer<typeof loginSchema>;
