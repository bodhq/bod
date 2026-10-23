import { zLoginRequestWritable } from "@bod/api-client/zod.gen";
import { z } from "zod";

/**
 * Centrální definice všech sdílených validačních pravidel napříč systémem.
 */

// Exportujeme vygenerované schéma pro přihlášení, čímž dodržujeme kontrakt
export const loginSchema = zLoginRequestWritable.extend({
  // The API normalizes usernames before validating them; mirror that for users
  // who enter a username with uppercase letters or surrounding whitespace.
  username: z.string().trim().toLowerCase().pipe(zLoginRequestWritable.shape.username),
});

export type LoginFormData = z.infer<typeof loginSchema>;
