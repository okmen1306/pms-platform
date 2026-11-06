import { z } from 'zod';
export const PerformanceScoreSubmittedEventSchema = z.object({
    projectId: z.guid(),
    employeeId: z.guid().optional(),
    teamLeadId: z.guid().optional(),
    criterionId: z.guid(),
    score: z.number().min(0).max(100),
});
export const PERFORMANCE_EVENTS = {
    SCORE_SUBMITTED: 'performance.score_submitted',
};
