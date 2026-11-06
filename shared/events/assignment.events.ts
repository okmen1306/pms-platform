import { z } from 'zod';

export const AssignmentCreatedEventSchema = z.object({
  assignmentId: z.string().uuid(),
  projectId: z.string().uuid(),
  employeeId: z.string().uuid(),
  workPackageId: z.string().uuid(),
  start: z.string().date(),
  end: z.string().date(),
});
export type AssignmentCreatedEvent = z.infer<typeof AssignmentCreatedEventSchema>;

export const AssignmentConflictDetectedEventSchema = z.object({
  employeeId: z.string().uuid(),
  conflictingAssignmentIds: z.array(z.string().uuid()),
});
export type AssignmentConflictDetectedEvent = z.infer<typeof AssignmentConflictDetectedEventSchema>;

export const ASSIGNMENT_EVENTS = {
  CREATED: 'assignment.created',
  CONFLICT_DETECTED: 'assignment.conflict_detected',
} as const;
