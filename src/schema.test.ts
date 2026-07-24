import { describe, it, expect } from 'vitest';
import {
  validateGameState,
  validateCustomLevel,
  validateScienceComposition,
  validateComposition,
  safeParseAndValidate,
  SCIENCE_TYPE_WHITELIST,
} from './schema';

describe('schema.validateCustomLevel', () => {
  it('accepts a valid custom level', () => {
    const r = validateCustomLevel({
      id: 'c-1',
      name: '我的关卡',
      worldId: 3,
      desc: '一段描述',
      a: 2,
      b: 3,
      motif: [0, 4, 7],
      ops: ['+', '*'],
      createdAt: '2026-07-24',
    });
    expect(r.ok).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('rejects non-object', () => {
    expect(validateCustomLevel(null).ok).toBe(false);
    expect(validateCustomLevel('hello').ok).toBe(false);
    expect(validateCustomLevel([]).ok).toBe(false);
  });

  it('rejects out-of-range worldId', () => {
    expect(validateCustomLevel({ name: 'x', worldId: 0, desc: 'd' }).ok).toBe(false);
    expect(validateCustomLevel({ name: 'x', worldId: 9, desc: 'd' }).ok).toBe(false);
    expect(validateCustomLevel({ name: 'x', worldId: 1.5, desc: 'd' }).ok).toBe(false);
  });

  it('rejects over-long name / desc', () => {
    expect(validateCustomLevel({ name: 'x'.repeat(51), worldId: 1, desc: 'd' }).ok).toBe(false);
    expect(validateCustomLevel({ name: 'x', worldId: 1, desc: 'd'.repeat(501) }).ok).toBe(false);
  });

  it('rejects motif out of range', () => {
    expect(
      validateCustomLevel({ name: 'x', worldId: 1, desc: 'd', motif: [99] }).ok
    ).toBe(false);
    expect(
      validateCustomLevel({ name: 'x', worldId: 1, desc: 'd', motif: [-13] }).ok
    ).toBe(false);
  });
});

describe('schema.validateScienceComposition', () => {
  it('accepts a whitelisted type', () => {
    const r = validateScienceComposition({ name: '硅能带', type: 'md', date: 1234567890 });
    expect(r.ok).toBe(true);
  });

  it('rejects unknown type (XSS hardening)', () => {
    const r = validateScienceComposition({ name: 'x', type: '<script>alert(1)</script>' });
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toContain('type must be one of');
  });

  it('rejects non-string name', () => {
    expect(validateScienceComposition({ name: 42, type: 'md' }).ok).toBe(false);
  });

  it('SCIENCE_TYPE_WHITELIST contains expected entries', () => {
    expect(SCIENCE_TYPE_WHITELIST.has('md')).toBe(true);
    expect(SCIENCE_TYPE_WHITELIST.has('xrd')).toBe(true);
    expect(SCIENCE_TYPE_WHITELIST.has('audio')).toBe(true);
    expect(SCIENCE_TYPE_WHITELIST.has('evil')).toBe(false);
  });
});

describe('schema.validateComposition', () => {
  it('accepts object without sections', () => {
    expect(validateComposition({ foo: 'bar' }).ok).toBe(true);
  });

  it('rejects too many sections', () => {
    const sections = Array.from({ length: 33 }, () => ({ name: 's' }));
    expect(validateComposition({ sections }).ok).toBe(false);
  });

  it('rejects non-object section', () => {
    expect(validateComposition({ sections: ['nope'] }).ok).toBe(false);
  });
});

describe('schema.validateGameState', () => {
  it('accepts a minimal valid state', () => {
    const r = validateGameState({ version: '1.0.0', progress: {} });
    expect(r.ok).toBe(true);
  });

  it('rejects missing version', () => {
    expect(validateGameState({ progress: {} }).ok).toBe(false);
  });

  it('rejects progress value out of 0-3', () => {
    const r = validateGameState({ version: '1', progress: { '1-1': 4 } });
    expect(r.ok).toBe(false);
  });

  it('rejects malformed achievements array', () => {
    const r = validateGameState({ version: '1', progress: {}, achievements: 'nope' });
    expect(r.ok).toBe(false);
  });

  it('rejects invalid customLevels entries', () => {
    const r = validateGameState({
      version: '1',
      progress: {},
      customLevels: [{ name: 'x', worldId: 99, desc: 'd' }],
    });
    expect(r.ok).toBe(false);
  });

  it('rejects invalid scienceCompositions entries', () => {
    const r = validateGameState({
      version: '1',
      progress: {},
      scienceCompositions: [{ name: 'x', type: 'evil-type' }],
    });
    expect(r.ok).toBe(false);
  });

  it('rejects non-object root', () => {
    expect(validateGameState('nope').ok).toBe(false);
    expect(validateGameState(null).ok).toBe(false);
    expect(validateGameState(42).ok).toBe(false);
  });
});

describe('schema.safeParseAndValidate', () => {
  it('parses valid JSON and validates', () => {
    const r = safeParseAndValidate('{"version":"1","progress":{}}', validateGameState);
    expect(r.ok).toBe(true);
  });

  it('fails on invalid JSON', () => {
    const r = safeParseAndValidate('{not json}', validateGameState);
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toContain('Invalid JSON');
  });

  it('fails on JSON that does not match schema', () => {
    const r = safeParseAndValidate('{"version":"1","progress":"nope"}', validateGameState);
    expect(r.ok).toBe(false);
  });
});
