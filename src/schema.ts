/**
 * 数据导入 schema 校验工具。
 *
 * 用于 `importGameData`、`importCustomLevel`、`importComposition`、`decodeShareCode` 等
 * 接受外部 JSON 数据的入口，防止存储型 XSS 与崩溃型输入。
 *
 * 不引入 Zod 等运行时依赖以保持 bundle 最小化，提供手写的轻量校验器。
 */

import type { GameState } from './store';

/** 校验结果。 */
export interface ValidationResult<T> {
  ok: boolean;
  value: T | null;
  errors: string[];
}

function ok<T>(value: T): ValidationResult<T> {
  return { ok: true, value, errors: [] };
}

function fail<T>(...errors: string[]): ValidationResult<T> {
  return { ok: false, value: null, errors };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** 检测对象是否含原型污染危险键（__proto__/constructor/prototype） */
function hasProtoPollutionKeys(obj: Record<string, unknown>): boolean {
  return Object.keys(obj).some(
    (k) => k === '__proto__' || k === 'constructor' || k === 'prototype'
  );
}

function isString(v: unknown): v is string {
  return typeof v === 'string';
}

function isNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function isInteger(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v);
}

function isBoolean(v: unknown): v is boolean {
  return typeof v === 'boolean';
}

/** 字符串长度限制（防 OOM）。 */
const MAX_STRING_LEN = 1000;
/** 数组长度限制。 */
const MAX_ARRAY_LEN = 10000;

function boundedString(v: unknown, max = MAX_STRING_LEN): boolean {
  return isString(v) && v.length <= max;
}

/** 已知科学类型白名单（与 science.ts 中保持一致）。 */
export const SCIENCE_TYPE_WHITELIST = new Set([
  'md',
  'csv',
  'json',
  'xrd',
  'ir',
  'uvvis',
  'raman',
  'nmr',
  'tga',
  'dtg',
  'dsc',
  'ms',
  'audio',
  'signal',
]);

/** 已知成就稀有度白名单。 */
export const ACHIEVEMENT_RARITY_WHITELIST = new Set(['common', 'rare', 'epic', 'legendary']);

/**
 * 校验自定义关卡 JSON。
 */
export function validateCustomLevel(data: unknown): ValidationResult<{
  id: string;
  name: string;
  worldId: number;
  desc: string;
  a?: number;
  b?: number;
  motif?: number[];
  ops?: string[];
  createdAt: string;
}> {
  if (!isObject(data)) return fail('Expected object');
  if (hasProtoPollutionKeys(data)) return fail('proto pollution keys detected');
  const d = data;
  if (!boundedString(d.name, 50)) return fail('name must be string ≤50 chars');
  if (!isInteger(d.worldId) || d.worldId < 1 || d.worldId > 8) return fail('worldId must be integer 1-8');
  if (!boundedString(d.desc, 500)) return fail('desc must be string ≤500 chars');
  if (d.id !== undefined && !boundedString(d.id, 100)) return fail('id must be string ≤100 chars');
  if (d.a !== undefined && !isInteger(d.a)) return fail('a must be integer');
  if (d.b !== undefined && !isInteger(d.b)) return fail('b must be integer');
  if (d.motif !== undefined) {
    if (!Array.isArray(d.motif) || d.motif.length > 64) return fail('motif must be array ≤64');
    for (const m of d.motif) {
      if (!isInteger(m) || m < -12 || m > 49) return fail('motif elements must be integer in [-12, 49]');
    }
  }
  if (d.ops !== undefined) {
    if (!Array.isArray(d.ops) || d.ops.length > 16) return fail('ops must be array ≤16');
    for (const op of d.ops) {
      if (!boundedString(op, 20)) return fail('ops elements must be string ≤20 chars');
    }
  }
  if (d.createdAt !== undefined && !boundedString(d.createdAt, 50)) return fail('createdAt must be string ≤50 chars');
  return ok(d as any);
}

/**
 * 校验科学作品 composition。
 */
export function validateScienceComposition(data: unknown): ValidationResult<{
  id?: number | string;
  name: string;
  type: string;
  date?: number | string;
  data?: unknown;
}> {
  if (!isObject(data)) return fail('Expected object');
  if (hasProtoPollutionKeys(data)) return fail('proto pollution keys detected');
  const d = data;
  if (!boundedString(d.name, 100)) return fail('name must be string ≤100 chars');
  // type 必须在白名单内（防止存储型 XSS：c.type 未净化就被 innerHTML 拼接）
  if (typeof d.type !== 'string' || d.type.length > 30 || !SCIENCE_TYPE_WHITELIST.has(d.type)) {
    return fail('type must be one of: ' + Array.from(SCIENCE_TYPE_WHITELIST).join(', '));
  }
  if (d.id !== undefined && !isNumber(d.id) && !boundedString(d.id, 100)) return fail('id must be number or string ≤100');
  if (d.date !== undefined && !isNumber(d.date) && !boundedString(d.date, 50)) return fail('date must be number or string ≤50');
  return ok(d as any);
}

/**
 * 校验作曲台作品。
 */
export function validateComposition(data: unknown): ValidationResult<{
  sections?: unknown[];
  [key: string]: unknown;
}> {
  if (!isObject(data)) return fail('Expected object');
  if (hasProtoPollutionKeys(data)) return fail('proto pollution keys detected');
  const d = data;
  if (d.sections !== undefined) {
    if (!Array.isArray(d.sections) || d.sections.length > 32) return fail('sections must be array ≤32');
    for (const sec of d.sections) {
      if (!isObject(sec)) return fail('section must be object');
      if (hasProtoPollutionKeys(sec)) return fail('section contains proto pollution keys');
      if (sec.name !== undefined && !boundedString(sec.name, 50)) return fail('section.name must be string ≤50');
      if (sec.cnName !== undefined && !boundedString(sec.cnName, 50)) return fail('section.cnName must be string ≤50');
    }
  }
  return ok(d as any);
}

/**
 * 校验完整 GameState 存档（用于 importGameData）。
 * 严格校验所有可能进入 innerHTML 的字段。
 */
export function validateGameState(data: unknown): ValidationResult<GameState> {
  if (!isObject(data)) return fail('Expected object');
  if (hasProtoPollutionKeys(data)) return fail('proto pollution keys detected');
  const d = data as Record<string, unknown>;
  const errors: string[] = [];

  // 必填字段
  if (!boundedString(d.version, 20)) errors.push('version must be string ≤20');
  if (!isObject(d.progress)) errors.push('progress must be object');
  // progress 的 key 是关卡 id（如 "1-1"），value 是星数 0-3
  if (isObject(d.progress)) {
    if (hasProtoPollutionKeys(d.progress)) {
      errors.push('progress contains proto pollution keys');
    } else {
      for (const [k, v] of Object.entries(d.progress)) {
        if (!boundedString(k, 20)) {
          errors.push('progress key too long: ' + k.slice(0, 20));
          continue;
        }
        if (!isInteger(v) || v < 0 || v > 3) errors.push('progress[' + k + '] must be integer 0-3');
      }
    }
  }

  // unlocks
  if (d.unlocks !== undefined && !isObject(d.unlocks)) errors.push('unlocks must be object');
  if (d.unlocks !== undefined && isObject(d.unlocks) && hasProtoPollutionKeys(d.unlocks)) {
    errors.push('unlocks contains proto pollution keys');
  }

  // 数组类字段
  if (d.achievements !== undefined) {
    if (!Array.isArray(d.achievements) || d.achievements.length > MAX_ARRAY_LEN) {
      errors.push('achievements must be array ≤' + MAX_ARRAY_LEN);
    } else {
      for (const a of d.achievements) {
        if (!boundedString(a, 50)) errors.push('achievement id must be string ≤50');
      }
    }
  }

  if (d.customLevels !== undefined) {
    if (!Array.isArray(d.customLevels) || d.customLevels.length > 100) {
      errors.push('customLevels must be array ≤100');
    } else {
      for (const lv of d.customLevels) {
        const r = validateCustomLevel(lv);
        if (!r.ok) errors.push('customLevel invalid: ' + r.errors.join('; '));
      }
    }
  }

  if (d.scienceCompositions !== undefined) {
    if (!Array.isArray(d.scienceCompositions) || d.scienceCompositions.length > MAX_ARRAY_LEN) {
      errors.push('scienceCompositions must be array ≤' + MAX_ARRAY_LEN);
    } else {
      for (const c of d.scienceCompositions) {
        const r = validateScienceComposition(c);
        if (!r.ok) errors.push('scienceComposition invalid: ' + r.errors.join('; '));
      }
    }
  }

  // 数字字段
  if (d.xp !== undefined && !isNumber(d.xp)) errors.push('xp must be number');
  if (d.level !== undefined && (!isInteger(d.level) || d.level < 1 || d.level > 99)) errors.push('level must be integer 1-99');
  if (d.dailyStreak !== undefined && !isInteger(d.dailyStreak)) errors.push('dailyStreak must be integer');
  if (d.combo !== undefined && !isInteger(d.combo)) errors.push('combo must be integer');

  // 字符串字段
  if (d.dailyLastDate !== undefined && !boundedString(d.dailyLastDate, 20)) errors.push('dailyLastDate must be string ≤20');
  if (d.lastLevel !== undefined && !boundedString(d.lastLevel, 20)) errors.push('lastLevel must be string ≤20');

  // wrongAnswerHistory
  if (d.wrongAnswerHistory !== undefined) {
    if (!Array.isArray(d.wrongAnswerHistory) || d.wrongAnswerHistory.length > 500) {
      errors.push('wrongAnswerHistory must be array ≤500');
    } else {
      for (const w of d.wrongAnswerHistory) {
        if (!isObject(w)) {
          errors.push('wrongAnswerRecord must be object');
          continue;
        }
        if (hasProtoPollutionKeys(w)) {
          errors.push('wrongAnswerRecord contains proto pollution keys');
          continue;
        }
        if (!isInteger(w.worldId)) errors.push('wrongAnswerRecord.worldId must be integer');
        if (!boundedString(w.worldName, 50)) errors.push('wrongAnswerRecord.worldName must be string ≤50');
        if (!boundedString(w.questionText, 500)) errors.push('wrongAnswerRecord.questionText must be string ≤500');
        if (w.correctAnswer !== undefined && !boundedString(String(w.correctAnswer), 200)) errors.push('wrongAnswerRecord.correctAnswer must be ≤200 chars');
        if (w.userAnswer !== undefined && !boundedString(String(w.userAnswer), 200)) errors.push('wrongAnswerRecord.userAnswer must be ≤200 chars');
      }
    }
  }

  if (errors.length > 0) return fail(...errors);
  return ok(d as unknown as GameState);
}

/** 安全地解析 JSON 并校验。 */
export function safeParseAndValidate<T>(
  raw: string,
  validator: (data: unknown) => ValidationResult<T>
): ValidationResult<T> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return fail('Invalid JSON: ' + (e instanceof Error ? e.message : String(e)));
  }
  return validator(parsed);
}
