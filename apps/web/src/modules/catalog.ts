import { resources as classbook, workflows as classbookActions } from "./classbook/resources";
import { resourceCopy } from "./resource-copy";
import { resourceIcons } from "./resource-icons";
import { workflows as roomActions, resources as rooms } from "./rooms/resources";
import { resources as school, workflows as schoolActions } from "./school/resources";
import { resources as timetable, workflows as timetableActions } from "./timetable/resources";

export const resources = [...school, ...rooms, ...timetable, ...classbook].map((resource) => ({
  ...resource,
  ...resourceCopy[resource.id],
  icon: resourceIcons[resource.id as keyof typeof resourceIcons],
}));
export const workflows = [
  ...schoolActions,
  ...roomActions,
  ...timetableActions,
  ...classbookActions,
];

export function getResource(id: string) {
  const resource = resources.find((item) => item.id === id);
  if (!resource) throw new Error(`Neznámá evidence: ${id}`);
  return resource;
}
export function getWorkflow(id: string) {
  const workflow = workflows.find((item) => item.id === id);
  if (!workflow) throw new Error(`Neznámá operace: ${id}`);
  return workflow;
}
