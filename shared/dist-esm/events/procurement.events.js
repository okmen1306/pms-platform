import { z } from 'zod';
export const MaterialPurchasedEventSchema = z.object({
    materialId: z.guid(),
    projectId: z.guid(),
    totalTl: z.number(),
    totalUsd: z.number(),
    purchaseDate: z.string().date(),
});
export const PROCUREMENT_EVENTS = {
    MATERIAL_PURCHASED: 'material.purchased',
};
