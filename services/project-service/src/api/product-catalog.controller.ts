import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ok, okList } from '@pms/shared';
import type { ProductCatalogRepository } from '../infrastructure/database/product-catalog.repository';

export function registerProductCatalogRoutes(app: FastifyInstance, deps: { catalogRepo: ProductCatalogRepository }) {
  app.get('/product-groups', async () => {
    const items = await deps.catalogRepo.listGroups();
    return okList(items, { page: 1, pageSize: items.length, total: items.length });
  });

  app.post('/product-groups', async (request) => {
    const { ad } = z.object({ ad: z.string().min(1) }).parse(request.body);
    const created = await deps.catalogRepo.createGroup(ad);
    return ok(created);
  });

  app.get('/products', async (request) => {
    const { groupId } = z.object({ groupId: z.string().uuid().optional() }).parse(request.query);
    const items = await deps.catalogRepo.listProducts(groupId);
    return okList(items, { page: 1, pageSize: items.length, total: items.length });
  });

  app.post('/products', async (request) => {
    const body = z.object({ ad: z.string().min(1), productGroupId: z.string().uuid() }).parse(request.body);
    const created = await deps.catalogRepo.createProduct(body.ad, body.productGroupId);
    return ok(created);
  });
}
