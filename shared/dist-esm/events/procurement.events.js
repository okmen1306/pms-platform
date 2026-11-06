import { z } from 'zod';
export const MaterialPurchasedEventSchema = z.object({
    materialId: z.string().uuid(),
    projectId: z.string().uuid(),
    totalTl: z.number(),
    totalUsd: z.number(),
    purchaseDate: z.string().date(),
});
export const PROCUREMENT_EVENTS = {
    MATERIAL_PURCHASED: 'material.purchased',
};
