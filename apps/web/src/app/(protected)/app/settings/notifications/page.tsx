"use client";

import { Activity, Bell, Calendar, Smartphone } from "lucide-react";
import { useId, useState } from "react";

import { SettingsGroup } from "../components/SettingsGroup";
import { SettingsToggleRow } from "../components/SettingsToggleRow";
import { SettingsPageHeading } from "../components/SettingsPageHeading";

export default function NotificationsSettingsPage() {
  const formId = useId();
  const [scheduleChanges, setScheduleChanges] = useState(true);
  const [weeklySummary, setWeeklySummary] = useState(false);
  const [pushNotifs, setPushNotifs] = useState(true);

  return (
    <section className="w-full max-w-2xl">
      <SettingsPageHeading
        title="Oznámení"
        description="Vyberte si, která oznámení chcete dostávat."
      />

      <div className="divide-y divide-(--color-border)">
        <SettingsGroup icon={<Bell />} title="E-mailová oznámení">
          <div className="divide-y divide-(--color-border)">
            <SettingsToggleRow
              id={`${formId}-schedule`}
              icon={<Calendar />}
              label="Změny v rozvrhu"
              description="Suplování a zrušené hodiny."
              checked={scheduleChanges}
              onChange={setScheduleChanges}
              className="py-4 first:pt-0 last:pb-0"
            />
            <SettingsToggleRow
              id={`${formId}-summary`}
              icon={<Activity />}
              label="Týdenní souhrn"
              description="Souhrn nadcházejícího týdne."
              checked={weeklySummary}
              onChange={setWeeklySummary}
              className="py-4 first:pt-0 last:pb-0"
            />
          </div>
        </SettingsGroup>

        <SettingsGroup icon={<Smartphone />} title="Push oznámení">
          <SettingsToggleRow
            id={`${formId}-push`}
            label="Okamžitá upozornění"
            description="Upozornění přímo na tomto zařízení."
            checked={pushNotifs}
            onChange={setPushNotifs}
          />
        </SettingsGroup>
      </div>
    </section>
  );
}
