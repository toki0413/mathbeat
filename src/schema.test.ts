import { describe, it, expect } from 'vitest';
import {
  validateGameState,
  validateCustomLevel,
  validateScienceComposition,
  validateComposition,
  safeParseAndValidate,
  SCIENCE_TYPE_WHITELIST,
  ACHIEVEMENT_RARITY_WHITELIST,
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

  it('accepts boundary worldId values 1 and 8', () => {
    expect(validateCustomLevel({ name: 'x', worldId: 1, desc: 'd' }).ok).toBe(true);
    expect(validateCustomLevel({ name: 'x', worldId: 8, desc: 'd' }).ok).toBe(true);
  });

  it('accepts boundary motif values -12 and 49', () => {
    expect(
      validateCustomLevel({ name: 'x', worldId: 1, desc: 'd', motif: [-12, 49] }).ok
    ).toBe(true);
  });

  it('rejects motif array too long (>64)', () => {
    const motif = new Array(65).fill(0);
    expect(
      validateCustomLevel({ name: 'x', worldId: 1, desc: 'd', motif }).ok
    ).toBe(false);
  });

  it('rejects motif non-array', () => {
    expect(
      validateCustomLevel({ name: 'x', worldId: 1, desc: 'd', motif: 'nope' }).ok
    ).toBe(false);
  });

  it('rejects motif non-integer elements', () => {
    expect(
      validateCustomLevel({ name: 'x', worldId: 1, desc: 'd', motif: [1.5] }).ok
    ).toBe(false);
  });

  it('rejects ops array too long (>16)', () => {
    const ops = new Array(17).fill('+');
    expect(
      validateCustomLevel({ name: 'x', worldId: 1, desc: 'd', ops }).ok
    ).toBe(false);
  });

  it('rejects ops non-array', () => {
    expect(
      validateCustomLevel({ name: 'x', worldId: 1, desc: 'd', ops: '+' }).ok
    ).toBe(false);
  });

  it('rejects ops elements too long (>20 chars)', () => {
    expect(
      validateCustomLevel({ name: 'x', worldId: 1, desc: 'd', ops: ['x'.repeat(21)] }).ok
    ).toBe(false);
  });

  it('rejects ops non-string elements', () => {
    expect(
      validateCustomLevel({ name: 'x', worldId: 1, desc: 'd', ops: [42] }).ok
    ).toBe(false);
  });

  it('rejects non-integer a/b', () => {
    expect(
      validateCustomLevel({ name: 'x', worldId: 1, desc: 'd', a: 1.5 }).ok
    ).toBe(false);
    expect(
      validateCustomLevel({ name: 'x', worldId: 1, desc: 'd', b: 'str' }).ok
    ).toBe(false);
  });

  it('rejects id too long (>100 chars)', () => {
    expect(
      validateCustomLevel({ id: 'x'.repeat(101), name: 'x', worldId: 1, desc: 'd' }).ok
    ).toBe(false);
  });

  it('rejects non-string id', () => {
    expect(
      validateCustomLevel({ id: 42, name: 'x', worldId: 1, desc: 'd' }).ok
    ).toBe(false);
  });

  it('rejects createdAt too long (>50 chars)', () => {
    expect(
      validateCustomLevel({ name: 'x', worldId: 1, desc: 'd', createdAt: 'x'.repeat(51) }).ok
    ).toBe(false);
  });

  it('rejects non-string name', () => {
    expect(validateCustomLevel({ name: 42, worldId: 1, desc: 'd' }).ok).toBe(false);
  });

  it('rejects non-string desc', () => {
    expect(validateCustomLevel({ name: 'x', worldId: 1, desc: 42 }).ok).toBe(false);
  });

  it('accepts level with only required fields (no optional fields)', () => {
    const r = validateCustomLevel({ name: 'x', worldId: 1, desc: 'd' });
    expect(r.ok).toBe(true);
    expect(r.value).toEqual({ name: 'x', worldId: 1, desc: 'd' });
  });

  it('returns the validated value on success', () => {
    const input = { id: 'c-1', name: 'lvl', worldId: 4, desc: 'd', a: 1, b: 2 };
    const r = validateCustomLevel(input);
    expect(r.ok).toBe(true);
    expect(r.value).toEqual(input);
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

  it('rejects non-object', () => {
    expect(validateScienceComposition(null).ok).toBe(false);
    expect(validateScienceComposition('hello').ok).toBe(false);
    expect(validateScienceComposition([]).ok).toBe(false);
  });

  it('rejects name too long (>100 chars)', () => {
    expect(
      validateScienceComposition({ name: 'x'.repeat(101), type: 'md' }).ok
    ).toBe(false);
  });

  it('rejects type too long (>30 chars)', () => {
    expect(
      validateScienceComposition({ name: 'x', type: 'md'.repeat(20) }).ok
    ).toBe(false);
  });

  it('rejects missing type', () => {
    expect(validateScienceComposition({ name: 'x' }).ok).toBe(false);
  });

  it('rejects missing name', () => {
    expect(validateScienceComposition({ type: 'md' }).ok).toBe(false);
  });

  it('accepts number id', () => {
    expect(validateScienceComposition({ name: 'x', type: 'md', id: 42 }).ok).toBe(true);
  });

  it('accepts string id within length limit', () => {
    expect(validateScienceComposition({ name: 'x', type: 'md', id: 'abc' }).ok).toBe(true);
  });

  it('rejects id too long (>100 chars)', () => {
    expect(
      validateScienceComposition({ name: 'x', type: 'md', id: 'x'.repeat(101) }).ok
    ).toBe(false);
  });

  it('rejects id that is neither number nor string', () => {
    expect(
      validateScienceComposition({ name: 'x', type: 'md', id: { obj: true } }).ok
    ).toBe(false);
  });

  it('accepts number date', () => {
    expect(validateScienceComposition({ name: 'x', type: 'md', date: 1234567890 }).ok).toBe(true);
  });

  it('accepts string date within length limit', () => {
    expect(validateScienceComposition({ name: 'x', type: 'md', date: '2026-07-24' }).ok).toBe(true);
  });

  it('rejects date too long (>50 chars)', () => {
    expect(
      validateScienceComposition({ name: 'x', type: 'md', date: 'x'.repeat(51) }).ok
    ).toBe(false);
  });

  it('rejects date that is neither number nor string', () => {
    expect(
      validateScienceComposition({ name: 'x', type: 'md', date: { obj: true } }).ok
    ).toBe(false);
  });

  it('accepts composition with optional data field', () => {
    expect(
      validateScienceComposition({ name: 'x', type: 'md', data: { any: 'thing' } }).ok
    ).toBe(true);
  });

  it('accepts all whitelist types', () => {
    const types = ['md', 'csv', 'json', 'xrd', 'ir', 'uvvis', 'raman', 'nmr', 'tga', 'dtg', 'dsc', 'ms', 'audio', 'signal'];
    for (const t of types) {
      expect(validateScienceComposition({ name: 'x', type: t }).ok).toBe(true);
    }
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

  it('rejects non-object root', () => {
    expect(validateComposition(null).ok).toBe(false);
    expect(validateComposition('hello').ok).toBe(false);
    expect(validateComposition([]).ok).toBe(false);
  });

  it('rejects sections non-array', () => {
    expect(validateComposition({ sections: 'nope' }).ok).toBe(false);
  });

  it('accepts section with valid name', () => {
    expect(
      validateComposition({ sections: [{ name: 'chorus' }] }).ok
    ).toBe(true);
  });

  it('accepts section with valid cnName', () => {
    expect(
      validateComposition({ sections: [{ cnName: '副歌' }] }).ok
    ).toBe(true);
  });

  it('rejects section name too long (>50 chars)', () => {
    expect(
      validateComposition({ sections: [{ name: 'x'.repeat(51) }] }).ok
    ).toBe(false);
  });

  it('rejects section cnName too long (>50 chars)', () => {
    expect(
      validateComposition({ sections: [{ cnName: 'x'.repeat(51) }] }).ok
    ).toBe(false);
  });

  it('rejects section with non-string name', () => {
    expect(
      validateComposition({ sections: [{ name: 42 }] }).ok
    ).toBe(false);
  });

  it('accepts empty sections array', () => {
    expect(validateComposition({ sections: [] }).ok).toBe(true);
  });

  it('accepts section with extra unknown fields', () => {
    expect(
      validateComposition({ sections: [{ name: 's', extra: 'ok' }] }).ok
    ).toBe(true);
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

  it('rejects version too long (>20 chars)', () => {
    expect(validateGameState({ version: 'x'.repeat(21), progress: {} }).ok).toBe(false);
  });

  it('rejects non-string version', () => {
    expect(validateGameState({ version: 42, progress: {} }).ok).toBe(false);
  });

  it('rejects non-object progress', () => {
    expect(validateGameState({ version: '1', progress: 'nope' }).ok).toBe(false);
  });

  it('accepts progress with valid 0-3 values', () => {
    expect(
      validateGameState({ version: '1', progress: { '1-1': 0, '1-2': 1, '1-3': 2, '1-4': 3 } }).ok
    ).toBe(true);
  });

  it('rejects non-integer progress value', () => {
    expect(
      validateGameState({ version: '1', progress: { '1-1': 1.5 } }).ok
    ).toBe(false);
  });

  it('rejects negative progress value', () => {
    expect(
      validateGameState({ version: '1', progress: { '1-1': -1 } }).ok
    ).toBe(false);
  });

  it('rejects progress key too long (>20 chars)', () => {
    const longKey = 'x'.repeat(21);
    expect(
      validateGameState({ version: '1', progress: { [longKey]: 1 } }).ok
    ).toBe(false);
  });

  it('rejects non-object unlocks', () => {
    expect(
      validateGameState({ version: '1', progress: {}, unlocks: 'nope' }).ok
    ).toBe(false);
  });

  it('accepts valid unlocks object', () => {
    expect(
      validateGameState({ version: '1', progress: {}, unlocks: { bass: true } }).ok
    ).toBe(true);
  });

  it('rejects achievements non-array', () => {
    expect(
      validateGameState({ version: '1', progress: {}, achievements: 'nope' }).ok
    ).toBe(false);
  });

  it('rejects achievements array too long (>10000)', () => {
    const achievements = new Array(10001).fill('id');
    expect(
      validateGameState({ version: '1', progress: {}, achievements }).ok
    ).toBe(false);
  });

  it('rejects achievement id not string', () => {
    expect(
      validateGameState({ version: '1', progress: {}, achievements: [42] }).ok
    ).toBe(false);
  });

  it('rejects achievement id too long (>50 chars)', () => {
    expect(
      validateGameState({ version: '1', progress: {}, achievements: ['x'.repeat(51)] }).ok
    ).toBe(false);
  });

  it('accepts valid achievements array', () => {
    expect(
      validateGameState({ version: '1', progress: {}, achievements: ['first', 'second'] }).ok
    ).toBe(true);
  });

  it('rejects customLevels non-array', () => {
    expect(
      validateGameState({ version: '1', progress: {}, customLevels: 'nope' }).ok
    ).toBe(false);
  });

  it('rejects customLevels array too long (>100)', () => {
    const customLevels = new Array(101).fill({ name: 'x', worldId: 1, desc: 'd' });
    expect(
      validateGameState({ version: '1', progress: {}, customLevels }).ok
    ).toBe(false);
  });

  it('accepts valid customLevels array', () => {
    expect(
      validateGameState({
        version: '1',
        progress: {},
        customLevels: [{ name: 'x', worldId: 1, desc: 'd' }],
      }).ok
    ).toBe(true);
  });

  it('rejects scienceCompositions non-array', () => {
    expect(
      validateGameState({ version: '1', progress: {}, scienceCompositions: 'nope' }).ok
    ).toBe(false);
  });

  it('rejects scienceCompositions array too long (>10000)', () => {
    const arr = new Array(10001).fill({ name: 'x', type: 'md' });
    expect(
      validateGameState({ version: '1', progress: {}, scienceCompositions: arr }).ok
    ).toBe(false);
  });

  it('accepts valid scienceCompositions array', () => {
    expect(
      validateGameState({
        version: '1',
        progress: {},
        scienceCompositions: [{ name: 'x', type: 'md' }],
      }).ok
    ).toBe(true);
  });

  it('rejects non-number xp', () => {
    expect(
      validateGameState({ version: '1', progress: {}, xp: 'nope' }).ok
    ).toBe(false);
  });

  it('accepts valid number xp', () => {
    expect(
      validateGameState({ version: '1', progress: {}, xp: 42.5 }).ok
    ).toBe(true);
  });

  it('rejects non-integer level', () => {
    expect(
      validateGameState({ version: '1', progress: {}, level: 1.5 }).ok
    ).toBe(false);
  });

  it('rejects level out of range (<1)', () => {
    expect(
      validateGameState({ version: '1', progress: {}, level: 0 }).ok
    ).toBe(false);
  });

  it('rejects level out of range (>99)', () => {
    expect(
      validateGameState({ version: '1', progress: {}, level: 100 }).ok
    ).toBe(false);
  });

  it('accepts boundary level values 1 and 99', () => {
    expect(validateGameState({ version: '1', progress: {}, level: 1 }).ok).toBe(true);
    expect(validateGameState({ version: '1', progress: {}, level: 99 }).ok).toBe(true);
  });

  it('rejects non-integer dailyStreak', () => {
    expect(
      validateGameState({ version: '1', progress: {}, dailyStreak: 1.5 }).ok
    ).toBe(false);
  });

  it('rejects non-integer combo', () => {
    expect(
      validateGameState({ version: '1', progress: {}, combo: 'nope' }).ok
    ).toBe(false);
  });

  it('rejects dailyLastDate too long (>20 chars)', () => {
    expect(
      validateGameState({ version: '1', progress: {}, dailyLastDate: 'x'.repeat(21) }).ok
    ).toBe(false);
  });

  it('rejects lastLevel too long (>20 chars)', () => {
    expect(
      validateGameState({ version: '1', progress: {}, lastLevel: 'x'.repeat(21) }).ok
    ).toBe(false);
  });

  it('rejects wrongAnswerHistory non-array', () => {
    expect(
      validateGameState({ version: '1', progress: {}, wrongAnswerHistory: 'nope' }).ok
    ).toBe(false);
  });

  it('rejects wrongAnswerHistory array too long (>500)', () => {
    const arr = new Array(501).fill({
      worldId: 1,
      worldName: 'w',
      questionText: 'q',
    });
    expect(
      validateGameState({ version: '1', progress: {}, wrongAnswerHistory: arr }).ok
    ).toBe(false);
  });

  it('rejects wrongAnswerRecord non-object', () => {
    expect(
      validateGameState({
        version: '1',
        progress: {},
        wrongAnswerHistory: ['nope'],
      }).ok
    ).toBe(false);
  });

  it('rejects wrongAnswerRecord missing worldId', () => {
    expect(
      validateGameState({
        version: '1',
        progress: {},
        wrongAnswerHistory: [{ worldName: 'w', questionText: 'q' }],
      }).ok
    ).toBe(false);
  });

  it('rejects wrongAnswerRecord non-integer worldId', () => {
    expect(
      validateGameState({
        version: '1',
        progress: {},
        wrongAnswerHistory: [{ worldId: 1.5, worldName: 'w', questionText: 'q' }],
      }).ok
    ).toBe(false);
  });

  it('rejects wrongAnswerRecord worldName too long (>50 chars)', () => {
    expect(
      validateGameState({
        version: '1',
        progress: {},
        wrongAnswerHistory: [{ worldId: 1, worldName: 'x'.repeat(51), questionText: 'q' }],
      }).ok
    ).toBe(false);
  });

  it('rejects wrongAnswerRecord questionText too long (>500 chars)', () => {
    expect(
      validateGameState({
        version: '1',
        progress: {},
        wrongAnswerHistory: [{ worldId: 1, worldName: 'w', questionText: 'x'.repeat(501) }],
      }).ok
    ).toBe(false);
  });

  it('rejects wrongAnswerRecord.correctAnswer too long (>200 chars)', () => {
    expect(
      validateGameState({
        version: '1',
        progress: {},
        wrongAnswerHistory: [{
          worldId: 1,
          worldName: 'w',
          questionText: 'q',
          correctAnswer: 'x'.repeat(201),
        }],
      }).ok
    ).toBe(false);
  });

  it('rejects wrongAnswerRecord.userAnswer too long (>200 chars)', () => {
    expect(
      validateGameState({
        version: '1',
        progress: {},
        wrongAnswerHistory: [{
          worldId: 1,
          worldName: 'w',
          questionText: 'q',
          userAnswer: 'x'.repeat(201),
        }],
      }).ok
    ).toBe(false);
  });

  it('accepts valid wrongAnswerRecord with all fields', () => {
    expect(
      validateGameState({
        version: '1',
        progress: {},
        wrongAnswerHistory: [{
          worldId: 1,
          worldName: 'w',
          questionText: 'q',
          correctAnswer: 42,
          userAnswer: '43',
          timestamp: 1234567890,
        }],
      }).ok
    ).toBe(true);
  });

  it('aggregates multiple errors', () => {
    const r = validateGameState({
      version: 42,
      progress: 'nope',
      xp: 'nope',
      level: 0,
    });
    expect(r.ok).toBe(false);
    expect(r.errors.length).toBeGreaterThan(1);
  });

  it('accepts a fully populated valid state', () => {
    const r = validateGameState({
      version: '1.1',
      progress: { '1-1': 3, '1-B': 1 },
      unlocks: { bass: true },
      achievements: ['first'],
      customLevels: [{ name: 'x', worldId: 1, desc: 'd' }],
      scienceCompositions: [{ name: 'x', type: 'md' }],
      xp: 100,
      level: 5,
      dailyStreak: 3,
      combo: 10,
      dailyLastDate: '2026-07-24',
      lastLevel: '1-1',
      wrongAnswerHistory: [{
        worldId: 1,
        worldName: 'w',
        questionText: 'q',
        correctAnswer: 5,
        userAnswer: 6,
      }],
    });
    expect(r.ok).toBe(true);
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

  it('works with other validators (validateCustomLevel)', () => {
    const r = safeParseAndValidate(
      '{"name":"x","worldId":1,"desc":"d"}',
      validateCustomLevel
    );
    expect(r.ok).toBe(true);
  });

  it('works with validateScienceComposition', () => {
    const r = safeParseAndValidate(
      '{"name":"x","type":"md"}',
      validateScienceComposition
    );
    expect(r.ok).toBe(true);
  });

  it('works with validateComposition', () => {
    const r = safeParseAndValidate('{"foo":"bar"}', validateComposition);
    expect(r.ok).toBe(true);
  });

  it('handles empty string input', () => {
    const r = safeParseAndValidate('', validateGameState);
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toContain('Invalid JSON');
  });

  it('handles JSON primitive input (e.g. number)', () => {
    const r = safeParseAndValidate('42', validateGameState);
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toContain('Expected object');
  });

  it('handles JSON null input', () => {
    const r = safeParseAndValidate('null', validateGameState);
    expect(r.ok).toBe(false);
  });

  it('handles JSON array input (root not object)', () => {
    const r = safeParseAndValidate('[]', validateGameState);
    expect(r.ok).toBe(false);
  });

  it('returns value=null on failure', () => {
    const r = safeParseAndValidate('invalid', validateGameState);
    expect(r.value).toBeNull();
  });

  it('returns errors array (never empty on failure)', () => {
    const r = safeParseAndValidate('invalid', validateGameState);
    expect(r.errors.length).toBeGreaterThan(0);
  });
});

describe('原型污染防御', () => {
  // 注意：对象字面量中 __proto__ 作为字面量键会触发原型 setter，不构成自有属性，
  // Object.keys 无法捕获。这里使用计算属性名 ['__proto__']（经 CreateDataProperty
  // 创建为自有可枚举属性），等价于 JSON.parse 的攻击向量，能被 hasProtoPollutionKeys 拦截。
  it('validateCustomLevel 拒绝 __proto__ 键', () => {
    const r = validateCustomLevel({ id: '1', name: 'test', worldId: 1, desc: 'd', ['__proto__']: { polluted: true } });
    expect(r.ok).toBe(false);
  });
  it('validateCustomLevel 拒绝 constructor 键', () => {
    const r = validateCustomLevel({ id: '1', name: 'test', worldId: 1, desc: 'd', constructor: { prototype: { x: 1 } } });
    expect(r.ok).toBe(false);
  });
  it('validateScienceComposition 拒绝 __proto__ 键', () => {
    const r = validateScienceComposition({ name: 't', type: 'md', ['__proto__']: { x: 1 } });
    expect(r.ok).toBe(false);
  });
  it('validateGameState 拒绝 __proto__ 键', () => {
    const r = validateGameState({ version: '1.1', progress: {}, ['__proto__']: { polluted: true } });
    expect(r.ok).toBe(false);
  });
  it('validateGameState 拒绝 progress 内 __proto__ 键', () => {
    const r = validateGameState({ version: '1.1', progress: { ['__proto__']: { polluted: true } } });
    expect(r.ok).toBe(false);
  });
  it('validateGameState 拒绝 unlocks 内 constructor 键', () => {
    const r = validateGameState({ version: '1.1', progress: {}, unlocks: { constructor: { prototype: { x: 1 } } } });
    expect(r.ok).toBe(false);
  });
  it('safeParseAndValidate 拒绝含 __proto__ 的 JSON 字符串', () => {
    const r = safeParseAndValidate('{"version":"1.1","progress":{},"__proto__":{"polluted":true}}', validateGameState);
    expect(r.ok).toBe(false);
  });

  it('validateCustomLevel 拒绝 prototype 键', () => {
    const r = validateCustomLevel({ id: '1', name: 'test', worldId: 1, desc: 'd', prototype: { x: 1 } });
    expect(r.ok).toBe(false);
  });

  it('validateScienceComposition 拒绝 constructor 键', () => {
    const r = validateScienceComposition({ name: 't', type: 'md', constructor: { prototype: { x: 1 } } });
    expect(r.ok).toBe(false);
  });

  it('validateScienceComposition 拒绝 prototype 键', () => {
    const r = validateScienceComposition({ name: 't', type: 'md', prototype: { x: 1 } });
    expect(r.ok).toBe(false);
  });

  it('validateComposition 拒绝 __proto__ 键', () => {
    const r = validateComposition({ ['__proto__']: { polluted: true } });
    expect(r.ok).toBe(false);
  });

  it('validateComposition 拒绝 section 内 __proto__ 键', () => {
    const r = validateComposition({ sections: [{ ['__proto__']: { polluted: true } }] });
    expect(r.ok).toBe(false);
  });

  it('validateComposition 拒绝 section 内 constructor 键', () => {
    const r = validateComposition({ sections: [{ constructor: { prototype: { x: 1 } } }] });
    expect(r.ok).toBe(false);
  });

  it('validateGameState 拒绝 unlocks 内 __proto__ 键', () => {
    const r = validateGameState({
      version: '1.1',
      progress: {},
      unlocks: { ['__proto__']: { polluted: true } },
    });
    expect(r.ok).toBe(false);
  });

  it('validateGameState 拒绝 unlocks 内 prototype 键', () => {
    const r = validateGameState({
      version: '1.1',
      progress: {},
      unlocks: { prototype: { x: 1 } },
    });
    expect(r.ok).toBe(false);
  });

  it('validateGameState 拒绝 wrongAnswerHistory 内 __proto__ 键', () => {
    const r = validateGameState({
      version: '1.1',
      progress: {},
      wrongAnswerHistory: [{
        worldId: 1,
        worldName: 'w',
        questionText: 'q',
        ['__proto__']: { polluted: true },
      }],
    });
    expect(r.ok).toBe(false);
  });

  it('safeParseAndValidate 拒绝含 constructor 的 JSON 字符串', () => {
    const r = safeParseAndValidate(
      '{"version":"1.1","progress":{},"constructor":{"prototype":{"x":1}}}',
      validateGameState
    );
    expect(r.ok).toBe(false);
  });
});

describe('ACHIEVEMENT_RARITY_WHITELIST', () => {
  it('contains common, rare, epic, legendary', () => {
    expect(ACHIEVEMENT_RARITY_WHITELIST.has('common')).toBe(true);
    expect(ACHIEVEMENT_RARITY_WHITELIST.has('rare')).toBe(true);
    expect(ACHIEVEMENT_RARITY_WHITELIST.has('epic')).toBe(true);
    expect(ACHIEVEMENT_RARITY_WHITELIST.has('legendary')).toBe(true);
  });

  it('rejects unknown rarities', () => {
    expect(ACHIEVEMENT_RARITY_WHITELIST.has('mythic')).toBe(false);
    expect(ACHIEVEMENT_RARITY_WHITELIST.has('')).toBe(false);
  });
});

describe('边界值与极端输入', () => {
  it('validateCustomLevel accepts empty string name (length 0)', () => {
    // boundedString 允许 length 0
    const r = validateCustomLevel({ name: '', worldId: 1, desc: '' });
    expect(r.ok).toBe(true);
  });

  it('validateGameState rejects empty object', () => {
    expect(validateGameState({}).ok).toBe(false);
  });

  it('validateGameState accepts empty progress object', () => {
    expect(validateGameState({ version: '1', progress: {} }).ok).toBe(true);
  });

  it('validateGameState handles NaN xp', () => {
    expect(
      validateGameState({ version: '1', progress: {}, xp: NaN }).ok
    ).toBe(false);
  });

  it('validateGameState handles Infinity xp', () => {
    expect(
      validateGameState({ version: '1', progress: {}, xp: Infinity }).ok
    ).toBe(false);
  });

  it('validateGameState handles negative combo', () => {
    // combo 仅校验 isInteger，不校验范围
    expect(
      validateGameState({ version: '1', progress: {}, combo: -5 }).ok
    ).toBe(true);
  });

  it('safeParseAndValidate handles deeply nested JSON', () => {
    let nested: any = { value: 1 };
    for (let i = 0; i < 50; i++) {
      nested = { child: nested };
    }
    const r = safeParseAndValidate(JSON.stringify(nested), validateGameState);
    expect(r.ok).toBe(false);
  });

  it('validateCustomLevel rejects undefined', () => {
    expect(validateCustomLevel(undefined).ok).toBe(false);
  });

  it('validateScienceComposition rejects undefined', () => {
    expect(validateScienceComposition(undefined).ok).toBe(false);
  });

  it('validateComposition rejects undefined', () => {
    expect(validateComposition(undefined).ok).toBe(false);
  });

  it('validateGameState rejects undefined', () => {
    expect(validateGameState(undefined).ok).toBe(false);
  });

  it('validateGameState rejects array root', () => {
    expect(validateGameState([1, 2, 3]).ok).toBe(false);
  });

  it('error messages are descriptive strings', () => {
    const r = validateCustomLevel(null);
    expect(r.ok).toBe(false);
    expect(typeof r.errors[0]).toBe('string');
    expect(r.errors[0].length).toBeGreaterThan(0);
  });
});
