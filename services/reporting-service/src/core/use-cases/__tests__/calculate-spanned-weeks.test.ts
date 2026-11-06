import { describe, it, expect } from 'vitest';
import { calculateSpannedWeeks } from '../calculate-spanned-weeks';

describe('calculateSpannedWeeks', () => {
  it('proje başlangıcıyla AYNI gün başlayan atama 1. haftadadır', () => {
    expect(calculateSpannedWeeks('2026-01-01', '2026-01-01', '2026-01-01')).toEqual([1]);
  });

  it('7 gün sonrası 2. haftadadır', () => {
    expect(calculateSpannedWeeks('2026-01-01', '2026-01-08', '2026-01-08')).toEqual([2]);
  });

  it('birden fazla haftayı kapsayan atama TÜM haftaları listeler', () => {
    expect(calculateSpannedWeeks('2026-01-01', '2026-01-01', '2026-01-15')).toEqual([1, 2, 3]);
  });

  it('proje başlangıcından ÖNCEKİ bir tarih 1. haftaya sabitlenir (negatif olmaz)', () => {
    expect(calculateSpannedWeeks('2026-01-15', '2026-01-01', '2026-01-01')).toEqual([1]);
  });

  it('tek günlük atama tek bir hafta döner', () => {
    const weeks = calculateSpannedWeeks('2026-01-01', '2026-03-01', '2026-03-01');
    expect(weeks).toHaveLength(1);
  });
});
