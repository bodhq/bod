/**
 * Centrální vrstva pro zachytávání a reportování chyb v aplikaci.
 * Nahrazuje surové `console.error` a připravuje infrastrukturu pro
 * budoucí integraci s analytickými nástroji jako Sentry nebo Datadog.
 */
class AppLogger {
  error(message: string, error?: unknown, context?: Record<string, unknown>) {
    // Zde v budoucnu: Sentry.captureException(error, { extra: context })
    console.error(`[ERROR] ${message}`, error || "", context || "");
  }

  warn(message: string, context?: Record<string, unknown>) {
    console.warn(`[WARN] ${message}`, context || "");
  }

  info(message: string, context?: Record<string, unknown>) {
    console.info(`[INFO] ${message}`, context || "");
  }
}

export const Logger = new AppLogger();
