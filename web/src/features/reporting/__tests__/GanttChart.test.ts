import { describe, it, expect } from 'vitest';
import { computeGanttBars } from '../GanttChart';
import type { WorkflowStatusEntry } from '../reporting.api';

const e = (o: Partial<WorkflowStatusEntry>): WorkflowStatusEntry => ({
  workPackageId: 'w', workPackageName: 'İP', employeeId: 'e', employeeName: 'Ali', baslangicTarihi: null, bitisTarihi: null,
  tamamlanmaYuzdesi: 0, durum: 'devam_ediyor', ...o,
});

describe('computeGanttBars (Day 21, F2)', () => {
  it('çubukları ortak zaman aralığına göre yüzde olarak yerleştirir', () => {
    const r = computeGanttBars([
      e({ baslangicTarihi: '2026-10-01', bitisTarihi: '2026-10-11', tamamlanmaYuzdesi: 50 }),
      e({ baslangicTarihi: '2026-10-11', bitisTarihi: '2026-10-21' }),
    ]);
    expect(r.rangeStart).toBe('2026-10-01');
    expect(r.rangeEnd).toBe('2026-10-21');
    expect(r.bars[0]).toMatchObject({ leftPct: 0, widthPct: 50, progressPct: 50 });
    expect(r.bars[1]).toMatchObject({ leftPct: 50, widthPct: 50 });
  });
  it('tarihsiz kayıtlar çizilmez ama skipped olarak sayılır', () => {
    const r = computeGanttBars([e({}), e({ baslangicTarihi: '2026-10-01', bitisTarihi: '2026-10-05' })]);
    expect(r.bars).toHaveLength(1);
    expect(r.skipped).toBe(1);
  });
  it('bitiş <= başlangıç ise çubuk 1 gün genişliğinde kalır; yüzde 0-100 aralığına kırpılır', () => {
    const r = computeGanttBars([
      e({ baslangicTarihi: '2026-10-01', bitisTarihi: '2026-10-01', tamamlanmaYuzdesi: 140 }),
      e({ baslangicTarihi: '2026-10-01', bitisTarihi: '2026-10-11' }),
    ]);
    expect(r.bars[0].widthPct).toBeCloseTo(10, 5);
    expect(r.bars[0].progressPct).toBe(100);
  });
  it('hiç tarihli kayıt yoksa boş döner', () => {
    expect(computeGanttBars([e({})])).toEqual({ bars: [], rangeStart: null, rangeEnd: null, skipped: 1 });
  });
});
