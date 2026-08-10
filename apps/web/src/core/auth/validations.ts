import { zLoginRequest } from "@bod/api-client/zod.gen";
import { z } from "zod";

/**
 * Centrální definice všech sdílených validačních pravidel napříč systémem.
 */

// Exportujeme vygenerované schéma pro přihlášení, čímž dodržujeme kontrakt
export const loginSchema = zLoginRequest;

export type LoginFormData = z.infer<typeof loginSchema>;
