import { describe, expect, it } from 'vitest';
import { getGreeting } from './greeting';

describe('getGreeting', () => {
  it('uses India time for the morning boundary', () => {
    expect(getGreeting(new Date('2026-10-22T06:29:00Z'))).toBe('Good morning');
  });

  it('uses India time for the afternoon boundary', () => {
    expect(getGreeting(new Date('2026-10-22T06:30:00Z'))).toBe('Good afternoon');
    expect(getGreeting(new Date('2026-10-22T12:29:00Z'))).toBe('Good afternoon');
  });

  it('uses India time for the evening boundary', () => {
    expect(getGreeting(new Date('2026-10-22T12:30:00Z'))).toBe('Good evening');
  });
});
