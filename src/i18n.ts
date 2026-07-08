// MathBeat i18n - Internationalization support (Chinese / English)

const translations = {
  zh: {
    // Home
    'app.title': 'MathBeat',
    'app.subtitle': '数学摇滚作曲学院',
    'home.stars': '星星',
    'home.combo': '最佳连击',
    'home.achievements': '成就',
    'home.daily': '今日挑战',
    'home.science': '科学之声',
    'home.freemode': '自由模式',
    'home.ach_page': '成就图鉴',
    'home.leaderboard': '周排行榜',
    'home.composer': '完整作曲台',
    'home.samples': '数学摇滚示例曲库',
    'home.samples_desc': '9 首内置数学摇滚（含 3 首真实科学数据作品），可试听并导入作曲台',
    'home.unlock_world6': '通关世界6解锁',
    'home.drums': '鼓组',
    'home.bass': '贝斯',
    'home.melody': '旋律',
    'home.chords': '和弦',
    'home.euclidean': '欧几里得',
    'home.modular': '模运算',
    'home.prime': '质数',
    'home.fibonacci': '斐波那契',
    'home.symmetry': '对称',
    'home.recursive': '递归',
    'home.cellular': '细胞自动机',
    'home.markov': '马尔可夫',
    'home.counterpoint': '对位',
    'home.science_mode': '独立模式',
    'home.freemode_label': '自由创作',
    'home.ach_label': '成就',
    'home.lb_label': '排行榜',
    'home.composer_label': '作曲台',
    'home.samples_label': '示例曲库',
    'home.continue_title': '继续上次关卡',
    'home.continue_action': '继续',

    // Worlds
    'world.1': 'LCM 与复节奏',
    'world.2': '对称群与和弦',
    'world.3': '频率比与调音',
    'world.4': 'GCD/CRT 与双环',
    'world.5': '排列与旋律变换',
    'world.6': '递归/欧几里得/分形',
    'world.7': '概率与随机',
    'world.8': '图论与和声',
    'world.sub.1': 'LCM & GCD → 复节奏',
    'world.sub.2': '对称群 → 和声',
    'world.sub.3': '频率比 → 音程',
    'world.sub.4': '中国剩余定理 → 对位',
    'world.sub.5': '排列组合 → 旋律',
    'world.sub.6': '递归/自相似 → 作曲',
    'world.sub.7': '概率分布 → 不确定音乐',
    'world.sub.8': '图与路径 → 和弦进行',

    // Common
    'common.play': '▶',
    'common.stop': '⏸',
    'common.reset': '⟲',
    'common.verify': '验证',
    'common.next': '下一关 →',
    'common.why': '为什么？',
    'common.hint': '💡 提示',
    'common.close': '✕',
    'common.back': '←',
    'common.submit': '提交验证',
    'common.generate': '📏 生成',

    // BGM
    'bgm.hint': '🎵 点击开启背景音乐',
    'bgm.on': '🔊',
    'bgm.off': '🔇',

    // Science
    'science.title': '🔬 科学之声',
    'science.step_mode': '选择类型',
    'science.step_data': '数据导入',
    'science.step_compose': '映射作曲',
    'science.generate': '生成音乐',
    'science.play': '▶ 播放',
    'science.save': '保存作品',
    'science.export': '导出到作曲台',
    'science.sample_data': '使用示例数据',
    'science.upload': '上传你的数据文件',
    'science.why': '为什么？',
    'science.share_text': '我在数律 MathBeat 的科学之声中用{type}数据生成了一段音乐！',

    // Toast / Confirm
    'toast.composer.copied': '作品信息已复制到剪贴板，可以粘贴分享给朋友！',
    'toast.composer.copy_failed': '复制失败，作品信息：\n',
    'toast.science.copied': '已复制分享文案',
    'toast.save.import_invalid': '存档格式不正确',
    'toast.save.import_success': '存档导入成功！',
    'toast.save.read_failed': '无法读取文件',
    'toast.save.reset_done': '进度已重置',
    'confirm.reset_progress': '确定要重置所有进度吗？此操作不可撤销。',
    'toast.unlock.world6_required': '完整作曲台需要通关世界6解锁',

    // Achievements (new)
    'achievement.mastery_world1.name': '世界1精通',
    'achievement.mastery_world1.desc': '世界1全部关卡三星',
    'achievement.mastery_world2.name': '世界2精通',
    'achievement.mastery_world2.desc': '世界2全部关卡三星',
    'achievement.mastery_world3.name': '世界3精通',
    'achievement.mastery_world3.desc': '世界3全部关卡三星',
    'achievement.mastery_world4.name': '世界4精通',
    'achievement.mastery_world4.desc': '世界4全部关卡三星',
    'achievement.mastery_world5.name': '世界5精通',
    'achievement.mastery_world5.desc': '世界5全部关卡三星',
    'achievement.mastery_world6.name': '世界6精通',
    'achievement.mastery_world6.desc': '世界6全部关卡三星',
    'achievement.mastery_world7.name': '世界7精通',
    'achievement.mastery_world7.desc': '世界7全部关卡三星',
    'achievement.mastery_world8.name': '世界8精通',
    'achievement.mastery_world8.desc': '世界8全部关卡三星',
    'achievement.perfect_all_bosses.name': 'Boss全完美',
    'achievement.perfect_all_bosses.desc': '全部Boss关三星',
    'achievement.endless_50.name': '无尽50分',
    'achievement.endless_50.desc': '无尽模式单局50分',
    'achievement.endless_100.name': '无尽100分',
    'achievement.endless_100.desc': '无尽模式单局100分',
    'achievement.import_sample.name': '示例曲复用',
    'achievement.import_sample.desc': '从示例曲库导入到作曲台',
    'achievement.share_composer.name': '分享作曲家',
    'achievement.share_composer.desc': '分享作曲台作品',
    'achievement.export_science.name': '科学之声导出',
    'achievement.export_science.desc': '从科学之声导出到作曲台',
    'achievement.create_custom_level.name': '关卡设计师',
    'achievement.create_custom_level.desc': '创建并保存自定义关卡',
  },
  en: {
    // Home
    'app.title': 'MathBeat',
    'app.subtitle': 'Math Rock Composer Academy',
    'home.stars': 'Stars',
    'home.combo': 'Best Combo',
    'home.achievements': 'Achievements',
    'home.daily': 'Daily Challenge',
    'home.science': 'Science of Sound',
    'home.freemode': 'Free Mode',
    'home.ach_page': 'Achievements',
    'home.leaderboard': 'Weekly Leaderboard',
    'home.composer': 'Full Composer',
    'home.samples': 'Math Rock Sample Library',
    'home.samples_desc': '9 built-in math rock tracks (incl. 3 real science data pieces), preview & import',
    'home.unlock_world6': 'Clear World 6 to unlock',
    'home.drums': 'Drums',
    'home.bass': 'Bass',
    'home.melody': 'Melody',
    'home.chords': 'Chords',
    'home.euclidean': 'Euclidean',
    'home.modular': 'Modular',
    'home.prime': 'Prime',
    'home.fibonacci': 'Fibonacci',
    'home.symmetry': 'Symmetry',
    'home.recursive': 'Recursive',
    'home.cellular': 'Cellular',
    'home.markov': 'Markov',
    'home.counterpoint': 'Counterpoint',
    'home.science_mode': 'Standalone',
    'home.freemode_label': 'Free Play',
    'home.ach_label': 'Awards',
    'home.lb_label': 'Ranking',
    'home.composer_label': 'Composer',
    'home.samples_label': 'Samples',
    'home.continue_title': 'Continue Last Level',
    'home.continue_action': 'Continue',

    // Worlds
    'world.1': 'LCM & Poly-rhythm',
    'world.2': 'Symmetry & Chords',
    'world.3': 'Frequency Ratios & Tuning',
    'world.4': 'GCD/CRT & Dual Rings',
    'world.5': 'Permutations & Melody',
    'world.6': 'Recursion/Euclidean/Fractal',
    'world.7': 'Probability & Randomness',
    'world.8': 'Graph Theory & Harmony',
    'world.sub.1': 'LCM & GCD → Poly-rhythm',
    'world.sub.2': 'Symmetry Group → Harmony',
    'world.sub.3': 'Frequency Ratio → Intervals',
    'world.sub.4': 'CRT → Counterpoint',
    'world.sub.5': 'Permutations → Melody',
    'world.sub.6': 'Recursion/Self-similar → Compose',
    'world.sub.7': 'Probability → Aleatory Music',
    'world.sub.8': 'Graph & Path → Chord Progression',

    // Common
    'common.play': '▶',
    'common.stop': '⏸',
    'common.reset': '⟲',
    'common.verify': 'Verify',
    'common.next': 'Next →',
    'common.why': 'Why?',
    'common.hint': '💡 Hint',
    'common.close': '✕',
    'common.back': '←',
    'common.submit': 'Submit',
    'common.generate': '📏 Generate',

    // BGM
    'bgm.hint': '🎵 Click to enable background music',
    'bgm.on': '🔊',
    'bgm.off': '🔇',

    // Science
    'science.title': '🔬 Science of Sound',
    'science.step_mode': 'Select Type',
    'science.step_data': 'Import Data',
    'science.step_compose': 'Map & Compose',
    'science.generate': 'Generate Music',
    'science.play': '▶ Play',
    'science.save': 'Save',
    'science.export': 'Export to Composer',
    'science.sample_data': 'Use Sample Data',
    'science.upload': 'Upload Your Data File',
    'science.why': 'Why?',
    'science.share_text': 'I generated a piece of music from {type} data in MathBeat Science of Sound!',

    // Toast / Confirm
    'toast.composer.copied': 'Composition info copied to clipboard. Share it with friends!',
    'toast.composer.copy_failed': 'Copy failed. Composition info:\n',
    'toast.science.copied': 'Share text copied',
    'toast.save.import_invalid': 'Invalid save file format',
    'toast.save.import_success': 'Save imported successfully!',
    'toast.save.read_failed': 'Unable to read file',
    'toast.save.reset_done': 'Progress reset',
    'confirm.reset_progress': 'Reset all progress? This cannot be undone.',
    'toast.unlock.world6_required': 'Unlock the full composer by clearing World 6',

    // Achievements (new)
    'achievement.mastery_world1.name': 'World 1 Mastery',
    'achievement.mastery_world1.desc': 'Get 3 stars on all World 1 levels',
    'achievement.mastery_world2.name': 'World 2 Mastery',
    'achievement.mastery_world2.desc': 'Get 3 stars on all World 2 levels',
    'achievement.mastery_world3.name': 'World 3 Mastery',
    'achievement.mastery_world3.desc': 'Get 3 stars on all World 3 levels',
    'achievement.mastery_world4.name': 'World 4 Mastery',
    'achievement.mastery_world4.desc': 'Get 3 stars on all World 4 levels',
    'achievement.mastery_world5.name': 'World 5 Mastery',
    'achievement.mastery_world5.desc': 'Get 3 stars on all World 5 levels',
    'achievement.mastery_world6.name': 'World 6 Mastery',
    'achievement.mastery_world6.desc': 'Get 3 stars on all World 6 levels',
    'achievement.mastery_world7.name': 'World 7 Mastery',
    'achievement.mastery_world7.desc': 'Get 3 stars on all World 7 levels',
    'achievement.mastery_world8.name': 'World 8 Mastery',
    'achievement.mastery_world8.desc': 'Get 3 stars on all World 8 levels',
    'achievement.perfect_all_bosses.name': 'Boss Perfectionist',
    'achievement.perfect_all_bosses.desc': 'Get 3 stars on all Boss levels',
    'achievement.endless_50.name': 'Endless 50',
    'achievement.endless_50.desc': 'Score 50 in endless mode',
    'achievement.endless_100.name': 'Endless 100',
    'achievement.endless_100.desc': 'Score 100 in endless mode',
    'achievement.import_sample.name': 'Sample Recycler',
    'achievement.import_sample.desc': 'Import a sample track into the composer',
    'achievement.share_composer.name': 'Share the Music',
    'achievement.share_composer.desc': 'Share a composer piece',
    'achievement.export_science.name': 'Science Export',
    'achievement.export_science.desc': 'Export from Science of Sound to composer',
    'achievement.create_custom_level.name': 'Level Designer',
    'achievement.create_custom_level.desc': 'Create and save a custom level',
  },
};

import { LS_KEYS } from './storage-keys';
import { localGet, localSet } from './storage';

let currentLang = 'zh';

export function getLang() {
  return currentLang;
}

export function setLang(lang: string) {
  if (translations[lang as keyof typeof translations]) {
    currentLang = lang;
    localSet(LS_KEYS.LANG, lang);
    applyTranslations();
    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new CustomEvent('mathbeat:langchange', { detail: lang }));
      } catch (e) {}
    }
  }
}

export function toggleLang() {
  setLang(currentLang === 'zh' ? 'en' : 'zh');
}

export function t(key: string) {
  const dict = translations[currentLang as keyof typeof translations] || translations.zh;
  return (dict as Record<string, string>)[key] || (translations.zh as Record<string, string>)[key] || key;
}

export function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    const val = t(key as string);
    if (val) el.textContent = val;
  });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => {
    const key = (el as HTMLElement).getAttribute('data-i18n-title');
    const val = t(key as string);
    if (val) (el as HTMLElement).title = val;
  });
  // Update lang button
  const btn = document.getElementById('langBtn');
  if (btn) btn.textContent = currentLang === 'zh' ? 'EN' : '中';
}

// Initialize from storage
const saved = localGet<string>(LS_KEYS.LANG, '');
if (saved && translations[saved as keyof typeof translations]) currentLang = saved;
