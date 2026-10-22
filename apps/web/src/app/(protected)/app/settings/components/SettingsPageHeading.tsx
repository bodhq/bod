interface SettingsPageHeadingProps {
  title: string;
  description: string;
}

export function SettingsPageHeading({ title, description }: SettingsPageHeadingProps) {
  return (
    <header className="mb-8 space-y-2">
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      <p className="max-w-2xl text-sm leading-6 text-(--color-muted-foreground)">{description}</p>
    </header>
  );
}
