import { z } from 'zod';

export const AssignmentCreatedEventSchema = z.object({
  assignmentId: z.guid(),
  projectId: z.guid(),
  employeeId: z.guid(),
  workPackageId: z.guid(),
  start: z.string().date(),
  end: z.string().date(),
});
export type AssignmentCreatedEvent = z.infer<typeof AssignmentCreatedEventSchema>;

export const AssignmentConflictDetectedEventSchema = z.object({
  employeeId: z.guid(),
  conflictingAssignmentIds: z.array(z.guid()),
});
export type AssignmentConflictDetectedEvent = z.infer<typeof AssignmentConflictDetectedEventSchema>;

export const ASSIGNMENT_EVENTS = {
  CREATED: 'assignment.created',
  CONFLICT_DETECTED: 'assignment.conflict_detected',
} as const;
