import { describe, it, expect } from 'vitest';
import { tlToUsd } from '../useExchangeRate';

describe('tlToUsd (Day 20 — Kural #5 USD önizlemesi)', () => {
  it('TL tutarını güncel kura böler, 2 ondalığa yuvarlar', () => {
    expect(tlToUsd(1000, 40)).toBe(25);
    expect(tlToUsd(100, 33.3333)).toBe(3);
    expect(tlToUsd(1234.56, 41.25)).toBe(29.93);
  });

  it('kur yok / sıfır / negatif / sonsuz ise null — yanlış değer GÖSTERİLMEZ', () => {
    expect(tlToUsd(1000, undefined)).toBeNull();
    expect(tlToUsd(1000, 0)).toBeNull();
    expect(tlToUsd(1000, -5)).toBeNull();
    expect(tlToUsd(1000, Infinity)).toBeNull();
    expect(tlToUsd(NaN, 40)).toBeNull();
  });

  it('0 TL → 0 USD (geçerli girdi)', () => {
    expect(tlToUsd(0, 40)).toBe(0);
  });
});
