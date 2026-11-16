import { Slider } from "@/core/ui/forms/Slider";

import { displayCost, relativeCost } from "../connections";

export function TransferCostField({
  label,
  description,
  value,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const number = Number(value.replace(",", "."));
  let valid = true;
  try {
    relativeCost(value);
  } catch {
    valid = false;
  }
  const nearest = valid ? Math.max(1, Math.min(10, Math.round(number * 10) / 10)) : 1;
  const onScale = valid && Math.abs(nearest - number) < 0.000001;
  return (
    <div className="ui-stack transfer-cost-field">
      <Slider
        label={label}
        description={`${description} 1 = nejsnazší, 10 = nejnáročnější. Pomalu nebo se Shiftem ladíte po 0,1.`}
        min={1}
        max={10}
        step={0.1}
        coarseStep={1}
        value={nearest}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      />
      {!onScale && (
        <p className="text-sm text-(--color-muted-foreground)">
          {valid
            ? `Uložená hodnota: ${displayCost(value)}. Posuvník ukazuje nejbližší stupeň; původní hodnota zůstane zachovaná, dokud ho neposunete.`
            : "Uložená hodnota není platná. Posuvníkem vyberte náročnost 1–10."}
        </p>
      )}
    </div>
  );
}
