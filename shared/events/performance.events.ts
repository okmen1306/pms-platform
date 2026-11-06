import { z } from 'zod';

export const PerformanceScoreSubmittedEventSchema = z.object({
  projectId: z.string().uuid(),
  employeeId: z.string().uuid().optional(),
  teamLeadId: z.string().uuid().optional(),
  criterionId: z.string().uuid(),
  score: z.number().min(0).max(100),
});
export type PerformanceScoreSubmittedEvent = z.infer<typeof PerformanceScoreSubmittedEventSchema>;

export const PERFORMANCE_EVENTS = {
  SCORE_SUBMITTED: 'performance.score_submitted',
} as const;
