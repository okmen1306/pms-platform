import { z } from 'zod';
export const PaginationQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(20),
});
export const PaginationMetaSchema = z.object({
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
});
