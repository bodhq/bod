import type { ReactNode } from "react";

export function SettingsGroup({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4 py-6 first:pt-0 last:pb-0">
      <h3 className="flex items-center gap-2 text-sm font-medium">
        <span className="text-(--color-muted-foreground) [&_svg]:size-4">{icon}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}
