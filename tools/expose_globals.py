import re
from pathlib import Path

def get_defined_functions(filepath: Path) -> set:
    """Extract all function names defined in a TS file (declarations + assignments)."""
    if not filepath.exists():
        return set()
    text = filepath.read_text(encoding='utf-8')
    funcs = set()
    # function name(...) — includes both declarations and named function expressions
    for m in re.finditer(r'function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(', text):
        funcs.add(m.group(1))
    # const/let/var name = function(...)
    for m in re.finditer(r'(?:let|const|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*function\s*\(', text):
        funcs.add(m.group(1))
    # const/let/var name = () => or (args) =>
    for m in re.finditer(r'(?:let|const|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:\([^)]*\)|)\s*=>', text):
        funcs.add(m.group(1))
    return funcs

def get_inline_handler_funcs(html_text: str) -> set:
    """Extract function names called in inline HTML event handlers."""
    funcs = set()
    for attr in ['onclick', 'onchange', 'oninput', 'onload', 'onsubmit']:
        pattern = re.compile(rf'{attr}="([^"]*)"')
        for m in pattern.finditer(html_text):
            code = m.group(1)
            for fm in re.finditer(r'([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(', code):
                name = fm.group(1)
                if name in ('if', 'while', 'for', 'switch', 'return', 'new', 'typeof',
                            'parseInt', 'parseFloat', 'Math', 'console', 'alert',
                            'confirm', 'prompt', 'event'):
                    continue
                funcs.add(name)
    return funcs

EXCLUDED = {
    'if', 'while', 'for', 'switch', 'return', 'new', 'typeof', 'parseInt',
    'parseFloat', 'Math', 'console', 'alert', 'confirm', 'prompt', 'window',
    'document', 'Object', 'Array', 'String', 'Number', 'Date', 'JSON',
    'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
    'requestAnimationFrame', 'localStorage', 'sessionStorage', 'fetch',
    'XMLHttpRequest', 'Promise', 'Error', 'Map', 'Set', 'RegExp'
}

# Resolve paths relative to this script (tools/ -> project root)
BASE_DIR = Path(__file__).resolve().parent.parent
files = [
    (BASE_DIR / 'src/main.ts', [BASE_DIR / 'index.html']),
    (BASE_DIR / 'src/composer.ts', [BASE_DIR / 'composer.html']),
]

for ts_path, html_deps in files:
    if not ts_path.exists():
        continue

    defined = get_defined_functions(ts_path)

    needed = set()
    for html_path in html_deps:
        if html_path.exists():
            html = html_path.read_text(encoding='utf-8')
            needed |= get_inline_handler_funcs(html)

    # Expose all defined functions (union of defined and needed, minus excluded)
    # Using typeof checks makes this safe even for false positives
    to_expose = sorted((defined | needed) - EXCLUDED)

    print(f'{ts_path}: exposing {len(to_expose)} functions')

    text = ts_path.read_text(encoding='utf-8')

    # Remove existing expose block
    pattern = r'/\* ===== EXPOSE GLOBALS FOR INLINE HTML HANDLERS ===== \*/[\s\S]*?(?=\n\n\n|\n/\*|$)'
    text = re.sub(pattern, '', text)

    if to_expose:
        # Use typeof checks so nonexistent names are safely skipped
        lines = []
        for name in to_expose:
            lines.append(f"if(typeof {name}!=='undefined')window.{name}={name};")
        assign = '\n/* ===== EXPOSE GLOBALS FOR INLINE HTML HANDLERS ===== */\n' + '\n'.join(lines) + '\n'
        text = text.rstrip() + '\n' + assign

    ts_path.write_text(text, encoding='utf-8')
    print(f'  Updated {ts_path}')

print('Done.')
