import { Logo } from "@/core/ui/Logo";

export function LoginBackground() {
  return (
    <div
      className="login-pattern pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      <div className="login-pattern__tiles absolute inset-[-30%] flex flex-col justify-center gap-y-16">
        {Array.from({ length: 32 }, (_, row) => ({ id: `pattern-row-${row}`, row })).map(
          ({ id, row }) => (
            <div
              key={id}
              className={`login-pattern__row login-pattern__row--${row % 2 === 0 ? "forward" : "reverse"}`}
            >
              {Array.from({ length: 32 }, (_, column) => ({ id: `pattern-logo-${column}` })).map(
                ({ id: logoId }) => (
                  <Logo
                    key={logoId}
                    className="h-4 w-auto shrink-0 text-(--color-foreground) opacity-[0.04]"
                    aria-hidden="true"
                  />
                ),
              )}
            </div>
          ),
        )}
      </div>
    </div>
  );
}
