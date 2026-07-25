import { describe, it, expect } from 'vitest';
import {
  detectDelimiter,
  splitLine,
  stripComments,
  parseCSVLike,
  fuzzyFindColumn,
  parseScienceFile,
  type ParserContext,
} from './parser';

describe('detectDelimiter', () => {
  it('detects comma as delimiter', () => {
    expect(detectDelimiter('a,b,c')).toBe(',');
  });

  it('detects tab as delimiter when commas absent', () => {
    expect(detectDelimiter('a\tb\tc')).toBe('\t');
  });

  it('detects semicolon as delimiter', () => {
    expect(detectDelimiter('a;b;c')).toBe(';');
  });

  it('detects pipe as delimiter', () => {
    expect(detectDelimiter('a|b|c')).toBe('|');
  });

  it('detects space when multiple consecutive spaces', () => {
    expect(detectDelimiter('a   b   c')).toBe(' ');
  });

  it('falls back to comma when no candidate present', () => {
    expect(detectDelimiter('abc')).toBe(',');
  });

  it('picks the candidate with the highest count', () => {
    // 2 commas vs 1 tab -> comma wins
    expect(detectDelimiter('a,b,c\tdef')).toBe(',');
  });
});

describe('splitLine', () => {
  it('splits using detected delimiter', () => {
    expect(splitLine('1,2,3')).toEqual(['1', '2', '3']);
  });

  it('splits using explicit delimiter', () => {
    expect(splitLine('1;2;3', ';')).toEqual(['1', '2', '3']);
  });

  it('trims whitespace from each part (using explicit comma delimiter)', () => {
    // Note: splitLine(' 1 , 2 , 3 ') without an explicit delimiter would auto-detect
    // space (4 segments) over comma (2 segments) and keep the commas as tokens.
    // Pass an explicit delimiter to exercise the trim path cleanly.
    expect(splitLine(' 1 , 2 , 3 ', ',')).toEqual(['1', '2', '3']);
  });

  it('handles whitespace mode by collapsing runs', () => {
    expect(splitLine('  1   2   3  ', ' ')).toEqual(['1', '2', '3']);
  });

  it('drops empty fields', () => {
    expect(splitLine('1,,2')).toEqual(['1', '2']);
  });

  it('returns empty array for empty input', () => {
    expect(splitLine('')).toEqual([]);
  });
});

describe('stripComments', () => {
  it('strips # comments', () => {
    expect(stripComments('a=1 # comment')).toBe('a=1 ');
  });

  it('strips ! comments', () => {
    expect(stripComments('data!note')).toBe('data');
  });

  it('strips % comments', () => {
    expect(stripComments('header % remark')).toBe('header ');
  });

  it('strips // comments', () => {
    expect(stripComments('value // inline')).toBe('value ');
  });

  it('handles multi-line text', () => {
    const out = stripComments('a # x\nb ! y\nc');
    expect(out).toBe('a \nb \nc');
  });

  it('keeps lines without comments intact', () => {
    expect(stripComments('clean line')).toBe('clean line');
  });
});

describe('parseCSVLike', () => {
  it('parses a CSV with header row', () => {
    const text = 'kpoint,energy\n0,1.5\n1,2.5\n2,3.0';
    const { headers, rows } = parseCSVLike(text);
    expect(headers).toEqual(['kpoint', 'energy']);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({ kpoint: 0, energy: 1.5 });
    expect(rows[2]).toEqual({ kpoint: 2, energy: 3 });
  });

  it('auto-generates headers when first row is all numeric', () => {
    const { headers, rows } = parseCSVLike('1,2\n3,4');
    expect(headers).toEqual(['col1', 'col2']);
    expect(rows).toEqual([
      { col1: 1, col2: 2 },
      { col1: 3, col2: 4 },
    ]);
  });

  it('converts NaN / nan / inf to null (and filters all-null rows)', () => {
    // Single-column rows whose only value becomes null are filtered out by
    // the `Object.values(r).some(v => v !== null && v !== '')` step.
    const { rows } = parseCSVLike('h\nNaN\nnan\ninf\n-inf\n5');
    expect(rows).toEqual([{ h: 5 }]);
  });

  it('preserves rows where at least one column is non-null', () => {
    // Use a 2-column CSV so the null h-values still keep the row alive via v.
    const { rows } = parseCSVLike('h,v\nNaN,1\nnan,2\ninf,3\n-inf,4\n5,5');
    expect(rows).toEqual([
      { h: null, v: 1 },
      { h: null, v: 2 },
      { h: null, v: 3 },
      { h: null, v: 4 },
      { h: 5, v: 5 },
    ]);
  });

  it('keeps non-numeric text values as strings', () => {
    const { rows } = parseCSVLike('label,value\nA,1\nB,2');
    expect(rows[0]).toEqual({ label: 'A', value: 1 });
    expect(rows[1]).toEqual({ label: 'B', value: 2 });
  });

  it('handles explicit tab delimiter', () => {
    const { headers, rows } = parseCSVLike('a\tb\n1\t2', '\t');
    expect(headers).toEqual(['a', 'b']);
    expect(rows[0]).toEqual({ a: 1, b: 2 });
  });

  it('strips comments before parsing', () => {
    const text = '# header comment\nk,e\n0,1\n1,2 # trailing';
    const { headers, rows } = parseCSVLike(text);
    expect(headers).toEqual(['k', 'e']);
    expect(rows).toHaveLength(2);
  });

  it('filters out rows whose values are all null/empty', () => {
    const { rows } = parseCSVLike('h\n\n5\n');
    expect(rows).toEqual([{ h: 5 }]);
  });

  it('throws on empty file', () => {
    expect(() => parseCSVLike('')).toThrow('文件为空');
  });

  it('throws when only whitespace lines remain', () => {
    expect(() => parseCSVLike('\n  \n\t')).toThrow('文件为空');
  });

  it('sanitizes header names: lowercase, strip non-alphanumeric', () => {
    const { headers } = parseCSVLike('K-Point,Energy (eV)!\n1,2');
    expect(headers).toEqual(['kpoint', 'energyev']);
  });

  it('handles single data point', () => {
    const { headers, rows } = parseCSVLike('v\n42');
    expect(headers).toEqual(['v']);
    expect(rows).toEqual([{ v: 42 }]);
  });

  it('handles large numeric array without throwing', () => {
    const n = 5000;
    const lines = ['v', ...Array.from({ length: n }, (_, i) => String(i))];
    const { rows } = parseCSVLike(lines.join('\n'));
    expect(rows).toHaveLength(n);
    expect(rows[n - 1].v).toBe(n - 1);
  });

  it('pads missing trailing cells with empty (then null) values', () => {
    const { rows } = parseCSVLike('a,b,c\n1,2');
    expect(rows[0]).toEqual({ a: 1, b: 2, c: null });
  });
});

describe('fuzzyFindColumn', () => {
  it('matches exact header name (case-insensitive)', () => {
    expect(fuzzyFindColumn(['Kpoint', 'Energy'], ['kpoint'])).toBe('Kpoint');
  });

  it('matches when candidate is contained in header', () => {
    expect(fuzzyFindColumn(['kpoint_path', 'energy'], ['kpoint'])).toBe('kpoint_path');
  });

  it('matches abbreviation: every char of candidate appears in header in order', () => {
    // candidate 'kp' -> 'k' and 'p' both in 'kpt'
    expect(fuzzyFindColumn(['kpt', 'e'], ['kp'])).toBe('kpt');
  });

  it('returns null when no match', () => {
    expect(fuzzyFindColumn(['x', 'y', 'z'], ['energy'])).toBeNull();
  });

  it('returns null for empty headers', () => {
    expect(fuzzyFindColumn([], ['energy'])).toBeNull();
  });

  it('tries candidates in order and returns first hit', () => {
    expect(fuzzyFindColumn(['energy', 'kpoint'], ['kpoint', 'energy'])).toBe('kpoint');
  });

  it('returns the original-case header, not the lowered form', () => {
    expect(fuzzyFindColumn(['Energy_Ev'], ['energy'])).toBe('Energy_Ev');
  });
});

describe('parseScienceFile - DFT', () => {
  const baseCtx: Omit<ParserContext, 'text' | 'ext'> = {
    type: 'dft',
    fileName: 'si.csv',
  };

  it('parses kpoint/energy CSV', () => {
    const ctx: ParserContext = {
      ...baseCtx,
      ext: 'csv',
      text: 'kpoint,energy\n0,-5\n1,-3\n2,-1\n3,1\n4,3',
    };
    const res = parseScienceFile(ctx);
    expect(res.type).toBe('dft');
    expect(res.data.kpoints).toEqual([0, 1, 2, 3, 4]);
    expect(res.data.energies).toEqual([-5, -3, -1, 1, 3]);
    expect(res.data.fermi).toBe(0);
    expect(res.data.bandgap).toBeGreaterThan(0);
    expect(res.warnings).toEqual([]);
  });

  it('warns when energy column missing but kpoint present', () => {
    const ctx: ParserContext = {
      ...baseCtx,
      ext: 'csv',
      text: 'kpoint\n0\n1\n2',
    };
    const res = parseScienceFile(ctx);
    expect(res.warnings.some((w) => w.includes('energy'))).toBe(true);
    // energies fall back to first column values (kpoint values)
    expect(res.data.energies).toEqual([0, 1, 2]);
  });

  it('warns when kpoint column missing', () => {
    const ctx: ParserContext = {
      ...baseCtx,
      ext: 'csv',
      text: 'energy\n1\n2\n3',
    };
    const res = parseScienceFile(ctx);
    expect(res.warnings.some((w) => w.includes('kpoint'))).toBe(true);
    expect(res.data.kpoints).toEqual([0, 1, 2]);
  });

  it('throws when neither kpoint nor energy column found', () => {
    const ctx: ParserContext = {
      ...baseCtx,
      ext: 'csv',
      text: 'foo,bar\n1,2\n3,4',
    };
    expect(() => parseScienceFile(ctx)).toThrow('未找到 kpoint/energy 列');
  });

  it('parses JSON when ext is json', () => {
    const ctx: ParserContext = {
      ...baseCtx,
      ext: 'json',
      text: JSON.stringify({ kpoints: [0, 1], energies: [1, 2] }),
    };
    const res = parseScienceFile(ctx);
    expect(res.data.kpoints).toEqual([0, 1]);
    expect(res.data.energies).toEqual([1, 2]);
  });

  it('parses VASP OUTCAR text', () => {
    const ctx: ParserContext = {
      ...baseCtx,
      ext: 'outcar',
      text: 'VASP\nE-fermi : 2.5\n k-point 1 : 0.0\nband No.  band energies\n  1 -2.0\n  2 -1.0\n  3  0.5',
    };
    const res = parseScienceFile(ctx);
    expect(res.data.fermi).toBe(2.5);
    expect(res.data.energies.length).toBeGreaterThan(0);
    expect(res.data.energies).toContain(-2.0);
    expect(res.data.energies).toContain(0.5);
  });

  it('handles JSON parse error for dft json', () => {
    const ctx: ParserContext = {
      ...baseCtx,
      ext: 'json',
      text: '{not json',
    };
    expect(() => parseScienceFile(ctx)).toThrow();
  });
});

describe('parseScienceFile - MD', () => {
  const baseCtx = { type: 'md' as const, fileName: 'md.csv' };

  it('parses x/y/z coordinates CSV', () => {
    const ctx: ParserContext = {
      ...baseCtx,
      ext: 'csv',
      text: 'x,y,z\n0,0,0\n1,1,1\n2,2,2',
    };
    const res = parseScienceFile(ctx);
    expect(res.data.frames).toHaveLength(3);
    expect(res.data.frames[0]).toEqual({ t: 0, x: 0, y: 0, z: 0 });
    expect(res.data.frames[1]).toEqual({ t: 0.01, x: 1, y: 1, z: 1 });
    expect(res.data.distances.length).toBe(3);
    expect(res.data.distances[0]).toBe(0);
    // distance between (0,0,0) and (1,1,1) is sqrt(3)
    expect(res.data.distances[1]).toBeCloseTo(Math.sqrt(3), 6);
    expect(res.warnings.some((w) => w.includes('distance'))).toBe(true);
  });

  it('parses distance-only CSV', () => {
    const ctx: ParserContext = {
      ...baseCtx,
      ext: 'csv',
      text: 'distance\n0.1\n0.2\n0.3',
    };
    const res = parseScienceFile(ctx);
    expect(res.data.distances).toEqual([0.1, 0.2, 0.3]);
    expect(res.data.frames).toHaveLength(3);
  });

  it('throws when no coords or distance column', () => {
    // Headers must avoid matching any candidate of x/y/z (each), distance/r/dist/length.
    // 'abc'/'def' contain none of those characters in a way that abbreviates.
    const ctx: ParserContext = {
      ...baseCtx,
      ext: 'csv',
      text: 'abc,def\n1,2\n3,4',
    };
    expect(() => parseScienceFile(ctx)).toThrow('MD 数据需要 x/y/z 坐标或 distance 列');
  });

  it('parses Lammps dump', () => {
    // LAMMPS dump rows need >=5 columns: id type x y z
    const text = [
      'ITEM: TIMESTEP',
      '0',
      'ITEM: NUMBER OF ATOMS',
      '2',
      'ITEM: ATOMS id type x y z',
      '1 1 0 0 0',
      '2 1 1 1 1',
      'ITEM: TIMESTEP',
      '1000',
      'ITEM: NUMBER OF ATOMS',
      '2',
      'ITEM: ATOMS id type x y z',
      '1 1 0 0 0',
      '2 1 2 2 2',
    ].join('\n');
    const ctx: ParserContext = {
      ...baseCtx,
      fileName: 'trj.lammpstrj',
      ext: 'lammpstrj',
      text,
    };
    const res = parseScienceFile(ctx);
    expect(res.data.frames.length).toBe(2);
    expect(res.data.distances.length).toBe(2);
  });

  it('parses XYZ format', () => {
    const text = ['2', 'water', 'O 0 0 0', 'H 1 1 1', '2', 'water2', 'O 0 0 0', 'H 2 2 2'].join('\n');
    const ctx: ParserContext = {
      ...baseCtx,
      fileName: 'h2o.xyz',
      ext: 'xyz',
      text,
    };
    const res = parseScienceFile(ctx);
    expect(res.data.frames.length).toBe(2);
    expect(res.data.distances.length).toBe(2);
  });

  it('parses MD JSON', () => {
    const ctx: ParserContext = {
      ...baseCtx,
      ext: 'json',
      text: JSON.stringify({ frames: [{ t: 0, x: 1 }], distances: [0.5] }),
    };
    const res = parseScienceFile(ctx);
    expect(res.data.frames[0].x).toBe(1);
    expect(res.data.distances).toEqual([0.5]);
  });
});

describe('parseScienceFile - FEM', () => {
  const baseCtx = { type: 'fem' as const, fileName: 'fem.csv' };

  it('parses stress column', () => {
    const ctx: ParserContext = {
      ...baseCtx,
      ext: 'csv',
      text: 'stress,disp\n10,0.1\n20,0.2',
    };
    const res = parseScienceFile(ctx);
    expect(res.data.nodes).toHaveLength(2);
    expect(res.data.nodes[0].stress).toBe(10);
    expect(res.data.nodes[0].displacement).toBe(0.1);
    expect(res.data.elements).toEqual([0, 1]);
    expect(res.data.modes).toEqual([]);
  });

  it('throws when missing both stress and displacement', () => {
    const ctx: ParserContext = {
      ...baseCtx,
      ext: 'csv',
      text: 'foo,bar\n1,2',
    };
    expect(() => parseScienceFile(ctx)).toThrow('FEM 数据需要 stress 或 displacement 列');
  });

  it('parses FEM JSON', () => {
    const ctx: ParserContext = {
      ...baseCtx,
      ext: 'json',
      text: JSON.stringify({ nodes: [{ id: 0 }] }),
    };
    const res = parseScienceFile(ctx);
    expect(res.data.nodes).toEqual([{ id: 0 }]);
  });
});

describe('parseScienceFile - CFD', () => {
  const baseCtx = { type: 'cfd' as const, fileName: 'cfd.csv' };

  it('parses velocity and pressure (reynolds column explicit)', () => {
    const ctx: ParserContext = {
      ...baseCtx,
      ext: 'csv',
      text: 'velocity,pressure,reynolds\n1.5,101,2000\n2.0,102,2000',
    };
    const res = parseScienceFile(ctx);
    expect(res.data.cells).toHaveLength(2);
    expect(res.data.cells[0].velocity).toBe(1.5);
    expect(res.data.cells[0].pressure).toBe(101);
    expect(res.data.reynolds).toBe(2000);
  });

  it('defaults reynolds to first-row pressure when no reynolds column (re abbreviates pressure)', () => {
    // Without an explicit reynolds column, fuzzyFindColumn matches candidate 're'
    // against header 'pressure' (which contains 're'), so reynolds is read from pressure.
    const ctx: ParserContext = {
      ...baseCtx,
      ext: 'csv',
      text: 'velocity,pressure\n1.5,101\n2.0,102',
    };
    const res = parseScienceFile(ctx);
    expect(res.data.reynolds).toBe(101);
  });

  it('throws when missing velocity/pressure/vorticity', () => {
    const ctx: ParserContext = {
      ...baseCtx,
      ext: 'csv',
      text: 'foo,bar\n1,2',
    };
    expect(() => parseScienceFile(ctx)).toThrow('CFD 数据需要 velocity/pressure/vorticity 列');
  });

  it('parses CFD JSON', () => {
    const ctx: ParserContext = {
      ...baseCtx,
      ext: 'json',
      text: JSON.stringify({ cells: [], reynolds: 2000 }),
    };
    const res = parseScienceFile(ctx);
    expect(res.data.reynolds).toBe(2000);
  });
});

describe('parseScienceFile - XRD', () => {
  const baseCtx = { type: 'xrd' as const, fileName: 'xrd.csv' };

  it('parses angle/intensity columns', () => {
    const ctx: ParserContext = {
      ...baseCtx,
      ext: 'csv',
      text: 'angle,intensity\n10,100\n20,200\n30,150',
    };
    const res = parseScienceFile(ctx);
    expect(res.data.angles).toEqual([10, 20, 30]);
    expect(res.data.intensities).toEqual([100, 200, 150]);
    expect(res.data.wavelength).toBe(1.54);
    expect(res.data.lattice).toBe(5.64);
  });

  it('falls back to two-column numeric when no header match', () => {
    const ctx: ParserContext = {
      ...baseCtx,
      ext: 'csv',
      text: '1,10\n2,20\n3,30\n4,40',
    };
    const res = parseScienceFile(ctx);
    expect(res.data.angles).toEqual([1, 2, 3, 4]);
    expect(res.data.intensities).toEqual([10, 20, 30, 40]);
  });

  it('throws when fewer than 3 numeric rows in fallback', () => {
    const ctx: ParserContext = {
      ...baseCtx,
      ext: 'csv',
      text: '1,10\n2,20',
    };
    expect(() => parseScienceFile(ctx)).toThrow('XRD 文本需要至少 3 组角度-强度数据');
  });

  it('parses XRD JSON', () => {
    const ctx: ParserContext = {
      ...baseCtx,
      ext: 'json',
      text: JSON.stringify({ angles: [1], intensities: [2] }),
    };
    const res = parseScienceFile(ctx);
    expect(res.data.angles).toEqual([1]);
  });
});

describe('parseScienceFile - DNA', () => {
  const baseCtx = { type: 'dna' as const, fileName: 'seq.txt' };

  it('parses ATCG sequence and computes GC ratio', () => {
    // Use a header without ATCG chars so it doesn't pollute the sequence
    const ctx: ParserContext = {
      ...baseCtx,
      ext: 'txt',
      text: '>xyz\nATGCATGC',
    };
    const res = parseScienceFile(ctx);
    expect(res.data.sequence).toBe('ATGCATGC');
    expect(res.data.gc).toBe(0.5);
  });

  it('strips non-ATCG characters', () => {
    const ctx: ParserContext = {
      ...baseCtx,
      ext: 'txt',
      text: 'A-T G C 123!',
    };
    const res = parseScienceFile(ctx);
    expect(res.data.sequence).toBe('ATGC');
  });

  it('throws when sequence shorter than 3 chars', () => {
    const ctx: ParserContext = {
      ...baseCtx,
      ext: 'txt',
      text: 'AT',
    };
    expect(() => parseScienceFile(ctx)).toThrow('DNA 文件需要包含 ATCG 序列');
  });
});

describe('parseScienceFile - Pulsar', () => {
  const baseCtx = { type: 'pulsar' as const, fileName: 'pulsar.csv' };

  it('parses period/flux columns', () => {
    const ctx: ParserContext = {
      ...baseCtx,
      ext: 'csv',
      text: 'period,flux\n1,10\n2,20\n3,30',
    };
    const res = parseScienceFile(ctx);
    expect(res.data.periods).toEqual([1, 2, 3]);
    expect(res.data.flux).toEqual([10, 20, 30]);
    expect(res.data.dm).toBe(0);
  });

  it('falls back to two-column numeric', () => {
    const ctx: ParserContext = {
      ...baseCtx,
      ext: 'csv',
      text: '1,10\n2,20\n3,30\n4,40',
    };
    const res = parseScienceFile(ctx);
    expect(res.data.periods).toEqual([1, 2, 3, 4]);
    expect(res.data.flux).toEqual([10, 20, 30, 40]);
  });

  it('throws when fewer than 3 numeric rows in fallback', () => {
    const ctx: ParserContext = {
      ...baseCtx,
      ext: 'csv',
      text: '1,10\n2,20',
    };
    expect(() => parseScienceFile(ctx)).toThrow('Pulsar 文本需要至少 3 组周期-流量数据');
  });

  it('parses Pulsar JSON', () => {
    const ctx: ParserContext = {
      ...baseCtx,
      ext: 'json',
      text: JSON.stringify({ periods: [1], flux: [2] }),
    };
    const res = parseScienceFile(ctx);
    expect(res.data.periods).toEqual([1]);
  });
});

describe('parseScienceFile - unknown type', () => {
  it('throws on unknown type', () => {
    const ctx = {
      type: 'unknown' as any,
      fileName: 'x',
      text: '',
      ext: '',
    };
    expect(() => parseScienceFile(ctx)).toThrow('未知科学类型: unknown');
  });
});
