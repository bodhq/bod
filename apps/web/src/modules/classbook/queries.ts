import { queryOptions } from "@tanstack/react-query";

import { workspaceKey } from "@/modules/shared/records/api";

import { getMyLessons } from "./api";

export const classbookQueries = {
  lessons: () =>
    queryOptions({
      queryKey: [...workspaceKey, "my-lessons"],
      queryFn: ({ signal }) => getMyLessons(signal),
    }),
};
