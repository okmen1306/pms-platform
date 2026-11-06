import type { PaginationMeta } from '../dto/pagination.dto';

/** roadmap.md Bölüm 8 — Standart Yanıt Formatı */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta: PaginationMeta | null;
  error: null;
}

export function ok<T>(data: T, meta: PaginationMeta | null = null): ApiSuccessResponse<T> {
  return { success: true, data, meta, error: null };
}

export function okList<T>(items: T[], meta: PaginationMeta): ApiSuccessResponse<T[]> {
  return { success: true, data: items, meta, error: null };
}
