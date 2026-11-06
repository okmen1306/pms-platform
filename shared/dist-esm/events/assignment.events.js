import { z } from 'zod';
export const AssignmentCreatedEventSchema = z.object({
    assignmentId: z.string().uuid(),
    projectId: z.string().uuid(),
    employeeId: z.string().uuid(),
    workPackageId: z.string().uuid(),
    start: z.string().date(),
    end: z.string().date(),
});
export const AssignmentConflictDetectedEventSchema = z.object({
    employeeId: z.string().uuid(),
    conflictingAssignmentIds: z.array(z.string().uuid()),
});
export const ASSIGNMENT_EVENTS = {
    CREATED: 'assignment.created',
    CONFLICT_DETECTED: 'assignment.conflict_detected',
};
