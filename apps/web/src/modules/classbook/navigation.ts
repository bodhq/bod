export function classbookViews(can: (permission: string) => boolean, activeRole?: string | null) {
  const journal = can("classbook.read") || can("classbook.write") || can("classbook.manage");
  const views = [
    ...(can("classbook.read") || can("classbook.write") || can("classbook.manage")
      ? [{ id: "lessons", title: "Deník výuky" }]
      : []),
    ...(can("classbook.read") && ["student", "parent"].includes(activeRole ?? "")
      ? [{ id: "attendance", title: "Moje docházka" }]
      : []),
    ...(can("attendance.request") ? [{ id: "excuses", title: "Moje omluvenky" }] : []),
    ...(can("attendance.mark") && !journal ? [{ id: "mark", title: "Zápis docházky" }] : []),
    ...(can("attendance.excuse") && !can("classbook.manage")
      ? [{ id: "decide", title: "Vyřízení omluvenky" }]
      : []),
    ...(can("classbook.manage") ? [{ id: "manage", title: "Docházka a omluvenky" }] : []),
  ];
  return ["student", "parent"].includes(activeRole ?? "")
    ? [...views].sort((a, b) => Number(b.id === "attendance") - Number(a.id === "attendance"))
    : views;
}
