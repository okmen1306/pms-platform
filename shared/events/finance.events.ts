import { z } from 'zod';

export const ProjectCostRecalculatedEventSchema = z.object({
  projectId: z.string().uuid(),
  toplamGerceklesenMaliyetTl: z.number(),
  karMarjiYuzde: z.number().nullable(),
});
export type ProjectCostRecalculatedEvent = z.infer<typeof ProjectCostRecalculatedEventSchema>;

export const FINANCE_EVENTS = {
  PROJECT_COST_RECALCULATED: 'finance.project_cost_recalculated',
} as const;
