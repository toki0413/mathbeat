#!/usr/bin/env python3
"""Convert shorthand property names in Object.assign(window as any, {...}) blocks
to explicit string-key pairs so that minified production builds still expose the
original global names for inline HTML event handlers.
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / 'src'


def explicit_keys(match: re.Match) -> str:
    prefix = match.group(1)  # e.g. "Object.assign(window as any, {"
    body = match.group(2)
    suffix = match.group(3)  # e.g. "});"

    lines = body.split('\n')
    new_lines = []
    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith('//') or stripped.startswith('/*'):
            new_lines.append(line)
            continue
        # Remove trailing comma for parsing
        has_comma = stripped.endswith(',')
        raw = stripped.rstrip(',').strip()
        if ':' in raw or raw.startswith('"') or raw.startswith("'"):
            # Already explicit or string-keyed
            new_lines.append(line)
            continue
        # Simple identifier shorthand
        new = f'{line[:line.find(stripped)]}{raw}: {raw}{"," if has_comma else ""}'
        new_lines.append(new)
    return prefix + '\n' + '\n'.join(new_lines) + '\n' + suffix


def transform(path: Path) -> bool:
    text = path.read_text(encoding='utf-8')
    original = text

    # Object.assign(window as any, { ... });
    text = re.sub(
        r'(Object\.assign\(window as any,\s*\{)\n(.*?)\n(\s*\}\);)',
        explicit_keys,
        text,
        flags=re.DOTALL,
    )

    # Also convert the `const handlers = { ... }` block in main.ts if present
    text = re.sub(
        r'(const handlers = \{)\n(.*?)\n(\s*\};)',
        explicit_keys,
        text,
        flags=re.DOTALL,
    )

    if text != original:
        path.write_text(text, encoding='utf-8')
        return True
    return False


def main():
    changed = []
    for path in ROOT.rglob('*.ts'):
        if transform(path):
            changed.append(str(path.relative_to(ROOT.parent)))
    if changed:
        print('Updated files:')
        for p in changed:
            print(' ', p)
    else:
        print('No shorthand expose blocks found.')


if __name__ == '__main__':
    main()
