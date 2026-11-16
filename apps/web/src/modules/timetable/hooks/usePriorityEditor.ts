"use client";
import type { Row } from "@/modules/shared/records/types";
import type { options } from "../preference-options";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { request, resourcePath } from "@/modules/shared/records/api";
import { useRecordCatalog } from "@/modules/shared/records/catalog";
import { useWorkspaceRefresh } from "@/modules/shared/records/hooks";

export function usePriorityEditor({
  option,
  current,
  version,
}: {
  option: (typeof options)[number];
  current?: Row;
  version: Row;
}) {
  const [weight, setWeight] = useState(String(current?.weight ?? 0));
  const { getResource } = useRecordCatalog();
  const refresh = useWorkspaceRefresh();
  const resource = getResource("timetable_preferences");
  const save = useMutation({
    mutationFn: async () => {
      if (current && resource.parsePatch)
        await request("PATCH", resourcePath(resource, current), {
          body: resource.parsePatch({ weight: Number(weight) }),
        });
      else
        await request("POST", resource.path, {
          body: resource.parseCreate({
            timetable_version_id: version.id,
            code: option.code,
            weight: Number(weight),
          }),
        });
      await refresh();
    },
  });
  return { weight, setWeight, save };
}
