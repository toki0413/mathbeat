import { Store } from './store';
import { LEVELS, WORLDS, Level } from './worlds';
import { showScreen } from './ui-render';
import { startLevel, state, checkAchievements } from './game-engine';
import { escapeHtml } from './utils';
import { renderWorld1 } from './worlds/world1';
import { renderWorld2 } from './worlds/world2';
import { renderWorld3 } from './worlds/world3';
import { renderWorld4 } from './worlds/world4';
import { renderWorld5 } from './worlds/world5';
import { renderWorld6 } from './worlds/world6';
import { renderWorld7 } from './worlds/world7';
import { renderWorld8 } from './worlds/world8';
import { registerActions, registerInputs } from './events';

export interface CustomLevel {
  id: string;
  name: string;
  worldId: number;
  desc: string;
  a?: number;
  b?: number;
  boss?: boolean;
  motif?: number[];
  ops?: string[];
  createdAt: string;
}

export function calculateDifficulty(level: CustomLevel): number {
  const w = level.worldId;
  if (w === 1 || w === 4) {
    const maxVal = Math.max(level.a || 2, level.b || 3);
    if (maxVal <= 5) return 1;
    if (maxVal <= 8) return 2;
    if (maxVal <= 12) return 3;
    if (maxVal <= 16) return 4;
    return 5;
  }
  if (w === 5) {
    const motifLen = (level.motif || []).length;
    const opCount = (level.ops || []).length;
    if (motifLen <= 3) return 1;
    if (motifLen <= 5) return opCount > 0 ? 3 : 2;
    if (motifLen <= 7) return opCount > 0 ? 4 : 3;
    return opCount > 1 ? 5 : 4;
  }
  if (w === 6) {
    const k = level.a || 3;
    const n = level.b || 8;
    const ratio = k / n;
    if (ratio <= 0.3) return 1;
    if (ratio <= 0.5) return 2;
    if (ratio <= 0.7) return 3;
    if (ratio <= 0.9) return 4;
    return 5;
  }
  if (w === 7) {
    const steps = level.b || 16;
    const prob = level.a || 50;
    const deviation = Math.abs(prob - 50);
    let score = 1;
    if (steps > 8) score++;
    if (steps > 16) score++;
    if (steps > 24) score++;
    if (deviation < 20) score++;
    if (deviation < 10) score++;
    return Math.min(5, score);
  }
  if (w === 2 || w === 3) return 2;
  if (w === 8) return 3;
  return 2;
}

export function starsHtml(rating: number): string {
  return [1, 2, 3, 4, 5]
    .map((i) => `<span style="color:${i <= rating ? 'var(--trackA)' : 'rgba(0,0,0,.1)'};font-size:16px">⭐</span>`)
    .join('');
}

/* ===== SHARE CODE ===== */
const SHARE_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

function encodeInt(n: number, digits: number): string {
  let s = '';
  for (let i = 0; i < digits; i++) {
    s = SHARE_ALPHABET[n % 62] + s;
    n = Math.floor(n / 62);
  }
  return s;
}

function decodeInt(s: string): number {
  let n = 0;
  for (const ch of s) {
    n = n * 62 + SHARE_ALPHABET.indexOf(ch);
  }
  return n;
}

export function encodeShareCode(level: CustomLevel): string {
  // Compact format: W|worldId|difficulty|params...
  const diff = calculateDifficulty(level);
  let payload = '';
  payload += encodeInt(level.worldId, 1);
  payload += encodeInt(diff, 1);

  if (level.worldId === 1 || level.worldId === 4) {
    payload += encodeInt(level.a || 2, 1);
    payload += encodeInt(level.b || 3, 1);
  } else if (level.worldId === 5) {
    const motif = level.motif || [0, 2, 4, 7];
    payload += encodeInt(motif.length, 1);
    motif.forEach((v) => (payload += encodeInt(v + 12, 1))); // shift by 12 to handle negatives
    const ops = (level.ops || []).join('');
    payload += encodeInt(ops.length, 1);
    if (ops.includes('retro')) payload += 'R';
    if (ops.includes('invert')) payload += 'I';
    if (ops.includes('rotate')) payload += 'O';
  } else if (level.worldId === 6) {
    payload += encodeInt(level.a || 3, 1);
    payload += encodeInt(level.b || 8, 1);
  } else if (level.worldId === 7) {
    payload += encodeInt((level.a || 50) / 10, 1); // prob/10
    payload += encodeInt(level.b || 16, 1);
  }

  // Add name hash (first 3 chars base62)
  const nameHash = level.name.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % (62 * 62 * 62);
  payload += encodeInt(nameHash, 3);

  return 'MB' + payload;
}

export function decodeShareCode(code: string): CustomLevel | null {
  if (!code.startsWith('MB')) return null;
  const payload = code.slice(2);
  if (payload.length < 2) return null;

  const worldId = decodeInt(payload[0]);
  if (worldId < 1 || worldId > 8) return null;

  const diff = decodeInt(payload[1]); // not used directly, for validation
  if (diff < 1 || diff > 5) return null;

  let idx = 2;
  const level: CustomLevel = {
    id: 'custom_' + Date.now(),
    name: '分享关卡',
    worldId,
    desc: '从分享码导入',
    createdAt: new Date().toISOString(),
  };

  if (worldId === 1 || worldId === 4) {
    if (payload.length < idx + 2) return null;
    level.a = decodeInt(payload[idx++]);
    level.b = decodeInt(payload[idx++]);
  } else if (worldId === 5) {
    if (payload.length < idx + 1) return null;
    const motifLen = decodeInt(payload[idx++]);
    if (payload.length < idx + motifLen) return null;
    const motif: number[] = [];
    for (let i = 0; i < motifLen; i++) {
      motif.push(decodeInt(payload[idx++]) - 12);
    }
    level.motif = motif;
    if (payload.length < idx + 1) return null;
    const opCount = decodeInt(payload[idx++]);
    const opStr = payload.slice(idx, idx + opCount);
    level.ops = [];
    if (opStr.includes('R')) level.ops.push('retro');
    if (opStr.includes('I')) level.ops.push('invert');
    if (opStr.includes('O')) level.ops.push('rotate');
  } else if (worldId === 6) {
    if (payload.length < idx + 2) return null;
    level.a = decodeInt(payload[idx++]);
    level.b = decodeInt(payload[idx++]);
  } else if (worldId === 7) {
    if (payload.length < idx + 2) return null;
    level.a = decodeInt(payload[idx++]) * 10;
    level.b = decodeInt(payload[idx++]);
  }

  return level;
}

let editorState: {
  worldId: number;
  params: Record<string, any>;
} = {
  worldId: 1,
  params: { a: 2, b: 3, name: '自定义关卡', desc: '' },
};

/* ===== PERSISTENCE ===== */
function loadCustomLevels(): CustomLevel[] {
  return Store.state.customLevels || [];
}

function saveCustomLevels(levels: CustomLevel[]): void {
  Store.state.customLevels = levels;
  Store.save();
  checkAchievements();
}

/* ===== EDITOR UI ===== */
export function openLevelEditor(): void {
  showScreen('levelEditor');
  renderEditor();
}

export function closeLevelEditor(): void {
  document.getElementById('levelEditorScreen')?.classList.remove('active');
  showScreen('home');
}

export function renderEditor(): void {
  const container = document.getElementById('levelEditorBody');
  if (!container) return;

  const worldOpts = WORLDS.map((w, i) => `<option value="${i + 1}">${w.emoji} ${w.name}</option>`).join('');

  container.innerHTML = `
    <div class="challenge-card">
      <div style="font-size:16px;font-weight:800;margin-bottom:12px">🎨 关卡编辑器</div>
      <div style="font-size:13px;color:var(--dim);margin-bottom:12px">设计你自己的数学音乐挑战，保存后与好友分享。</div>
      
      <div style="margin-bottom:10px">
        <label style="font-size:13px;font-weight:700;display:block;margin-bottom:4px">世界类型</label>
        <select id="leWorld" data-input="changeEditorWorld" style="font-size:14px;font-weight:700;padding:6px 10px;border-radius:8px;border:2px solid #e8e4de;width:100%">
          ${worldOpts}
        </select>
      </div>
      
      <div style="margin-bottom:10px">
        <label style="font-size:13px;font-weight:700;display:block;margin-bottom:4px">关卡名称</label>
        <input id="leName" type="text" value="${escapeHtml(editorState.params.name || '')}" placeholder="输入关卡名称" style="font-size:14px;font-weight:700;padding:6px 10px;border-radius:8px;border:2px solid #e8e4de;width:100%">
      </div>
      
      <div style="margin-bottom:10px">
        <label style="font-size:13px;font-weight:700;display:block;margin-bottom:4px">描述</label>
        <input id="leDesc" type="text" value="${escapeHtml(editorState.params.desc || '')}" placeholder="输入关卡描述" style="font-size:14px;font-weight:700;padding:6px 10px;border-radius:8px;border:2px solid #e8e4de;width:100%">
      </div>
      
      <div id="leParams"></div>
      
      <div id="leDifficultyPreview" style="margin-top:10px;font-size:13px;font-weight:700"></div>
      
      <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
        <button class="verify-btn" data-action="previewCustomLevel">👁 预览</button>
        <button class="ctrl-btn" style="background:var(--success);color:#fff" data-action="saveCustomLevel">💾 保存</button>
        <button class="ctrl-btn" data-action="exportCustomLevel">📤 导出</button>
        <button class="ctrl-btn" style="background:var(--w3);color:#fff" data-action="copyShareCode">🔗 分享码</button>
      </div>
      
      <div id="leShareCode" style="margin-top:8px;display:none">
        <div style="font-size:12px;font-weight:700;color:var(--dim);margin-bottom:4px">分享码</div>
        <div style="display:flex;gap:6px">
          <input id="leShareInput" type="text" readonly style="font-size:13px;font-weight:700;padding:6px 10px;border-radius:8px;border:2px solid #e8e4de;flex:1;background:rgba(0,0,0,.03)">
          <button class="ctrl-btn" style="font-size:12px" data-action="copyShareCodeToClipboard">复制</button>
        </div>
      </div>
    </div>
    
    <div class="challenge-card" style="margin-top:10px">
      <div style="font-size:16px;font-weight:800;margin-bottom:10px">👁 实时预览</div>
      <div id="lePreviewContainer" style="min-height:200px;background:var(--bg);border-radius:12px;padding:12px;overflow:hidden"></div>
    </div>
    
    <div class="challenge-card" style="margin-top:10px">
      <div style="font-size:16px;font-weight:800;margin-bottom:10px">📥 导入关卡</div>
      <div style="display:flex;gap:6px;margin-bottom:8px">
        <input id="leImportCode" type="text" placeholder="粘贴分享码 (MB...)" style="font-size:13px;font-weight:700;padding:6px 10px;border-radius:8px;border:2px solid #e8e4de;flex:1">
        <button class="ctrl-btn" style="font-size:12px;background:var(--w3);color:#fff" data-action="importShareCode">导入</button>
      </div>
      <div class="science-file-wrap" style="display:inline-block">
        <button class="ctrl-btn">选择 JSON 文件</button>
        <input type="file" accept=".json" data-input="importCustomLevel">
      </div>
      <div style="font-size:12px;color:var(--dim);margin-top:6px">支持分享码、JSON 文件导入</div>
    </div>
  `;

  renderEditorParams();
  renderDifficultyPreview();
}

export function renderEditorParams(): void {
  const el = document.getElementById('leParams');
  if (!el) return;
  const w = editorState.worldId;
  let html = '';

  if (w === 1 || w === 4) {
    html = `
      <div style="display:flex;gap:10px;margin-bottom:10px">
        <div style="flex:1">
          <label style="font-size:13px;font-weight:700;display:block;margin-bottom:4px">周期 A</label>
          <input id="leA" type="number" value="${editorState.params.a || 2}" min="2" max="16" data-input="renderDifficultyPreview" style="font-size:14px;font-weight:700;padding:6px 10px;border-radius:8px;border:2px solid #e8e4de;width:100%;text-align:center">
        </div>
        <div style="flex:1">
          <label style="font-size:13px;font-weight:700;display:block;margin-bottom:4px">周期 B</label>
          <input id="leB" type="number" value="${editorState.params.b || 3}" min="2" max="16" data-input="renderDifficultyPreview" style="font-size:14px;font-weight:700;padding:6px 10px;border-radius:8px;border:2px solid #e8e4de;width:100%;text-align:center">
        </div>
      </div>`;
  } else if (w === 5) {
    html = `
      <div style="margin-bottom:10px">
        <label style="font-size:13px;font-weight:700;display:block;margin-bottom:4px">动机（半音偏移，逗号分隔）</label>
        <input id="leMotif" type="text" value="${(editorState.params.motif || [0, 2, 4, 7]).join(',')}" placeholder="例如: 0,2,4,7" data-input="renderDifficultyPreview" style="font-size:14px;font-weight:700;padding:6px 10px;border-radius:8px;border:2px solid #e8e4de;width:100%">
      </div>
      <div style="margin-bottom:10px">
        <label style="font-size:13px;font-weight:700;display:block;margin-bottom:4px">变换操作</label>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${['retro', 'invert', 'rotate'].map((op) => `<label style="font-size:13px;display:flex;align-items:center;gap:4px;cursor:pointer"><input type="checkbox" class="le-op" value="${op}" data-input="renderDifficultyPreview" ${(editorState.params.ops || []).includes(op) ? 'checked' : ''}> ${op === 'retro' ? '逆行' : op === 'invert' ? '倒影' : '循环移位'}</label>`).join('')}
        </div>
      </div>`;
  } else if (w === 6) {
    html = `
      <div style="display:flex;gap:10px;margin-bottom:10px">
        <div style="flex:1">
          <label style="font-size:13px;font-weight:700;display:block;margin-bottom:4px">脉冲数 k</label>
          <input id="leK" type="number" value="${editorState.params.k || 3}" min="1" max="12" data-input="renderDifficultyPreview" style="font-size:14px;font-weight:700;padding:6px 10px;border-radius:8px;border:2px solid #e8e4de;width:100%;text-align:center">
        </div>
        <div style="flex:1">
          <label style="font-size:13px;font-weight:700;display:block;margin-bottom:4px">总步数 n</label>
          <input id="leN" type="number" value="${editorState.params.n || 8}" min="4" max="16" data-input="renderDifficultyPreview" style="font-size:14px;font-weight:700;padding:6px 10px;border-radius:8px;border:2px solid #e8e4de;width:100%;text-align:center">
        </div>
      </div>`;
  } else if (w === 7) {
    html = `
      <div style="display:flex;gap:10px;margin-bottom:10px">
        <div style="flex:1">
          <label style="font-size:13px;font-weight:700;display:block;margin-bottom:4px">概率 %</label>
          <input id="leProb" type="number" value="${editorState.params.prob || 50}" min="10" max="100" data-input="renderDifficultyPreview" style="font-size:14px;font-weight:700;padding:6px 10px;border-radius:8px;border:2px solid #e8e4de;width:100%;text-align:center">
        </div>
        <div style="flex:1">
          <label style="font-size:13px;font-weight:700;display:block;margin-bottom:4px">步数</label>
          <input id="leSteps" type="number" value="${editorState.params.steps || 16}" min="4" max="32" data-input="renderDifficultyPreview" style="font-size:14px;font-weight:700;padding:6px 10px;border-radius:8px;border:2px solid #e8e4de;width:100%;text-align:center">
        </div>
      </div>`;
  }

  el.innerHTML = html;
  renderDifficultyPreview();
}

export function changeEditorWorld(wid: string): void {
  editorState.worldId = parseInt(wid);
  editorState.params = { a: 2, b: 3, name: '自定义关卡', desc: '', motif: [0, 2, 4, 7], ops: [] };
  renderEditorParams();
  renderDifficultyPreview();
}

export function saveCustomLevel(): void {
  const name = (document.getElementById('leName') as HTMLInputElement)?.value.trim();
  const desc = (document.getElementById('leDesc') as HTMLInputElement)?.value.trim();
  if (!name) {
    showHintFloat('❌ 请输入关卡名称');
    return;
  }

  const level: CustomLevel = {
    id: 'custom_' + Date.now(),
    name,
    worldId: editorState.worldId,
    desc: desc || '自定义关卡',
    createdAt: new Date().toISOString(),
  };

  if (editorState.worldId === 1 || editorState.worldId === 4) {
    level.a = parseInt((document.getElementById('leA') as HTMLInputElement)?.value || '2');
    level.b = parseInt((document.getElementById('leB') as HTMLInputElement)?.value || '3');
  } else if (editorState.worldId === 5) {
    const motifStr = (document.getElementById('leMotif') as HTMLInputElement)?.value || '0,2,4,7';
    level.motif = motifStr
      .split(',')
      .map((s) => parseInt(s.trim()))
      .filter((n) => !isNaN(n));
    const checked = document.querySelectorAll('.le-op:checked') as NodeListOf<HTMLInputElement>;
    level.ops = Array.from(checked).map((c) => c.value);
  } else if (editorState.worldId === 6) {
    level.a = parseInt((document.getElementById('leK') as HTMLInputElement)?.value || '3');
    level.b = parseInt((document.getElementById('leN') as HTMLInputElement)?.value || '8');
  } else if (editorState.worldId === 7) {
    level.a = parseInt((document.getElementById('leProb') as HTMLInputElement)?.value || '50');
    level.b = parseInt((document.getElementById('leSteps') as HTMLInputElement)?.value || '16');
  }

  const levels = loadCustomLevels();
  levels.push(level);
  saveCustomLevels(levels);
  renderCustomLevelList();
  showHintFloat('✅ 关卡已保存！');
}

export function deleteCustomLevel(id: string): void {
  const levels = loadCustomLevels().filter((l) => l.id !== id);
  saveCustomLevels(levels);
  renderCustomLevelList();
  showHintFloat('已删除');
}

export function playCustomLevel(id: string): void {
  const level = loadCustomLevels().find((l) => l.id === id);
  if (!level) return;

  // Temporarily inject into LEVELS
  const tempId = level.id;
  const tempLevel: any = {
    id: tempId,
    name: level.name,
    desc: level.desc,
    a: level.a,
    b: level.b,
    motif: level.motif,
    ops: level.ops,
    boss: false,
  };

  // Add to LEVELS if not already there
  if (!LEVELS[level.worldId]) LEVELS[level.worldId] = [];
  const existing = LEVELS[level.worldId].find((l) => l.id === tempId);
  if (!existing) LEVELS[level.worldId].push(tempLevel);

  startLevel(level.worldId, tempId);
}

export function exportCustomLevel(): void {
  const level = buildCurrentLevel();
  if (!level) return;
  const blob = new Blob([JSON.stringify(level, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `mathbeat_level_${level.name.replace(/\s+/g, '_')}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  showHintFloat('📤 关卡已导出');
}

export function exportCustomLevelById(id: string): void {
  const level = loadCustomLevels().find((l) => l.id === id);
  if (!level) return;
  const blob = new Blob([JSON.stringify(level, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `mathbeat_level_${level.name.replace(/\s+/g, '_')}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function importCustomLevel(input: HTMLInputElement): void {
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result as string);
      if (!data.name || !data.worldId) {
        showHintFloat('❌ 无效的关卡文件');
        return;
      }
      const level: CustomLevel = {
        id: 'custom_' + Date.now(),
        name: data.name,
        worldId: data.worldId,
        desc: data.desc || '导入关卡',
        a: data.a,
        b: data.b,
        motif: data.motif,
        ops: data.ops,
        createdAt: new Date().toISOString(),
      };
      const levels = loadCustomLevels();
      levels.push(level);
      saveCustomLevels(levels);
      renderCustomLevelList();
      showHintFloat('✅ 导入成功！');
    } catch (e) {
      showHintFloat('❌ 文件格式错误');
    }
  };
  reader.readAsText(file);
}

export function previewCustomLevel(): void {
  const level = buildCurrentLevel();
  if (!level) return;
  renderLevelPreview();
  showHintFloat(`👁 预览: ${level.name} (世界${level.worldId})`);
}

export function renderLevelPreview(): void {
  const level = buildCurrentLevel();
  if (!level) return;

  const container = document.getElementById('lePreviewContainer');
  if (!container) return;

  // Save current state
  const savedWorld = state.currentWorld;
  const savedLevel = state.currentLevel;
  const savedW1 = { ...state.w1 };

  // Temporarily inject level into LEVELS
  const tempId = 'preview_' + Date.now();
  const tempLevel: any = {
    id: tempId,
    name: level.name,
    desc: level.desc,
    a: level.a,
    b: level.b,
    motif: level.motif,
    ops: level.ops,
    boss: false,
  };
  if (!LEVELS[level.worldId]) LEVELS[level.worldId] = [];
  LEVELS[level.worldId].push(tempLevel);

  // Temporarily set game state
  state.currentWorld = level.worldId;
  state.currentLevel = tempId;

  // Render
  container.innerHTML = '';
  try {
    switch (level.worldId) {
      case 1:
        renderWorld1(container, tempId);
        break;
      case 2:
        renderWorld2(container, tempId);
        break;
      case 3:
        renderWorld3(container, tempId);
        break;
      case 4:
        renderWorld4(container, tempId);
        break;
      case 5:
        renderWorld5(container, tempId);
        break;
      case 6:
        renderWorld6(container, tempId);
        break;
      case 7:
        renderWorld7(container, tempId);
        break;
      case 8:
        renderWorld8(container, tempId);
        break;
      default:
        container.innerHTML = '<div style="color:var(--dim);font-size:13px;text-align:center">该世界暂不支持预览</div>';
    }
  } catch (e) {
    container.innerHTML = '<div style="color:var(--error);font-size:13px;text-align:center">预览渲染失败</div>';
  }

  // Restore state
  state.currentWorld = savedWorld;
  state.currentLevel = savedLevel;
  state.w1 = savedW1;
  LEVELS[level.worldId] = LEVELS[level.worldId].filter((l: any) => l.id !== tempId);
}

function buildCurrentLevel(): CustomLevel | null {
  const name = (document.getElementById('leName') as HTMLInputElement)?.value.trim();
  const desc = (document.getElementById('leDesc') as HTMLInputElement)?.value.trim();
  if (!name) {
    showHintFloat('❌ 请输入关卡名称');
    return null;
  }

  const level: CustomLevel = {
    id: 'custom_' + Date.now(),
    name,
    worldId: editorState.worldId,
    desc: desc || '自定义关卡',
    createdAt: new Date().toISOString(),
  };

  if (editorState.worldId === 1 || editorState.worldId === 4) {
    level.a = parseInt((document.getElementById('leA') as HTMLInputElement)?.value || '2');
    level.b = parseInt((document.getElementById('leB') as HTMLInputElement)?.value || '3');
  } else if (editorState.worldId === 5) {
    const motifStr = (document.getElementById('leMotif') as HTMLInputElement)?.value || '0,2,4,7';
    level.motif = motifStr
      .split(',')
      .map((s) => parseInt(s.trim()))
      .filter((n) => !isNaN(n));
    const checked = document.querySelectorAll('.le-op:checked') as NodeListOf<HTMLInputElement>;
    level.ops = Array.from(checked).map((c) => c.value);
  } else if (editorState.worldId === 6) {
    level.a = parseInt((document.getElementById('leK') as HTMLInputElement)?.value || '3');
    level.b = parseInt((document.getElementById('leN') as HTMLInputElement)?.value || '8');
  } else if (editorState.worldId === 7) {
    level.a = parseInt((document.getElementById('leProb') as HTMLInputElement)?.value || '50');
    level.b = parseInt((document.getElementById('leSteps') as HTMLInputElement)?.value || '16');
  }

  return level;
}

function renderCustomLevelList(): void {
  const el = document.getElementById('customLevelList');
  if (!el) return;
  const levels = loadCustomLevels();
  if (levels.length === 0) {
    el.innerHTML =
      '<div style="font-size:13px;color:var(--dim);text-align:center;padding:12px">还没有自定义关卡，创建你的第一个吧！</div>';
    return;
  }

  el.innerHTML = levels
    .map((l) => {
      const w = WORLDS[l.worldId - 1];
      const diff = calculateDifficulty(l);
      return `<div style="background:rgba(0,0,0,.03);border-radius:10px;padding:10px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center">
      <div>
        <div style="font-size:14px;font-weight:700">${w.emoji} ${escapeHtml(l.name)} ${starsHtml(diff)}</div>
        <div style="font-size:11px;color:var(--dim)">${escapeHtml(l.desc)} · ${w.name}</div>
      </div>
      <div style="display:flex;gap:4px">
        <button class="ctrl-btn" style="font-size:12px;padding:4px 10px" data-action="playCustomLevel" data-args='["${l.id}"]'>▶</button>
        <button class="ctrl-btn" style="font-size:12px;padding:4px 10px" data-action="exportCustomLevelById" data-args='["${l.id}"]'>📤</button>
        <button class="ctrl-btn" style="font-size:12px;padding:4px 10px;background:var(--error);color:#fff" data-action="deleteCustomLevel" data-args='["${l.id}"]'>🗑</button>
      </div>
    </div>`;
    })
    .join('');
}

export function renderDifficultyPreview(): void {
  const el = document.getElementById('leDifficultyPreview');
  if (!el) return;
  const level = buildCurrentLevel();
  if (!level) {
    el.innerHTML = '';
    return;
  }
  const diff = calculateDifficulty(level);
  el.innerHTML = `难度: ${starsHtml(diff)}`;
}

export function copyShareCode(): void {
  const level = buildCurrentLevel();
  if (!level) return;
  const code = encodeShareCode(level);
  const container = document.getElementById('leShareCode');
  const input = document.getElementById('leShareInput') as HTMLInputElement;
  if (container && input) {
    container.style.display = 'block';
    input.value = code;
  }
}

export function copyShareCodeToClipboard(): void {
  const input = document.getElementById('leShareInput') as HTMLInputElement;
  if (!input) return;
  navigator.clipboard
    .writeText(input.value)
    .then(() => showHintFloat('✅ 分享码已复制'))
    .catch(() => showHintFloat('请手动复制'));
}

export function importShareCode(): void {
  const input = document.getElementById('leImportCode') as HTMLInputElement;
  if (!input) return;
  const code = input.value.trim();
  if (!code) return;
  const level = decodeShareCode(code);
  if (!level) {
    showHintFloat('❌ 无效的分享码');
    return;
  }
  const levels = loadCustomLevels();
  levels.push(level);
  saveCustomLevels(levels);
  renderCustomLevelList();
  input.value = '';
  showHintFloat('✅ 分享码导入成功！');
}

function showHintFloat(text: string): void {
  const el = document.getElementById('hintFloat');
  if (!el) return;
  el.textContent = text;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3000);
}
/* ===== EXPOSE GLOBALS ===== */
// route delegated clicks/inputs back to the editor fns. handlers that read a
// field value or carry an id are wrapped to pull those out of the event/args.
registerActions({
  previewCustomLevel,
  saveCustomLevel,
  exportCustomLevel,
  copyShareCode,
  copyShareCodeToClipboard,
  importShareCode,
  playCustomLevel: (_e, id) => playCustomLevel(id as string),
  exportCustomLevelById: (_e, id) => exportCustomLevelById(id as string),
  deleteCustomLevel: (_e, id) => deleteCustomLevel(id as string),
});
registerInputs({
  changeEditorWorld: (e) => changeEditorWorld((e.target as HTMLSelectElement).value),
  importCustomLevel: (e) => importCustomLevel(e.target as HTMLInputElement),
  renderDifficultyPreview,
});
Object.assign(window as any, {
  calculateDifficulty: calculateDifficulty,
  changeEditorWorld: changeEditorWorld,
  closeLevelEditor: closeLevelEditor,
  copyShareCode: copyShareCode,
  copyShareCodeToClipboard: copyShareCodeToClipboard,
  decodeShareCode: decodeShareCode,
  deleteCustomLevel: deleteCustomLevel,
  encodeShareCode: encodeShareCode,
  exportCustomLevel: exportCustomLevel,
  exportCustomLevelById: exportCustomLevelById,
  importCustomLevel: importCustomLevel,
  importShareCode: importShareCode,
  openLevelEditor: openLevelEditor,
  playCustomLevel: playCustomLevel,
  previewCustomLevel: previewCustomLevel,
  renderDifficultyPreview: renderDifficultyPreview,
  renderEditor: renderEditor,
  renderEditorParams: renderEditorParams,
  renderLevelPreview: renderLevelPreview,
  saveCustomLevel: saveCustomLevel,
  starsHtml: starsHtml,
});
