import { Logo } from "@/core/ui/Logo";

export function LoginBackground() {
  return (
    <div className="login-pattern pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="login-pattern__tiles absolute inset-[-30%] flex flex-col justify-center gap-y-12">
        {Array.from({ length: 32 }, (_, row) => (
          <div
            key={row}
            className={`login-pattern__row ${row % 2 === 0 ? "login-pattern__row--forward" : "login-pattern__row--reverse"}`}
          >
            {Array.from({ length: 32 }, (_, column) => (
              <Logo
                key={column}
                className="h-5 w-auto shrink-0 text-(--color-foreground) opacity-[0.06]"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
