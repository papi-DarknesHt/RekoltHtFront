import os
import re

root = os.path.join(os.path.dirname(__file__), '..', 'src')
texts = set()
for dirpath, dirnames, filenames in os.walk(root):
    for fn in filenames:
        if fn.endswith(('.js', '.jsx', '.ts', '.tsx')):
            path = os.path.join(dirpath, fn)
            with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                data = f.read()
            for m in re.finditer(r'"([^\"]{2,})"|\'([^\']{2,})\'', data):
                s = m.group(1) or m.group(2)
                s = s.strip()
                if len(s) > 1 and re.search(r'[A-Za-zÀ-ÿ]', s) and not s.startswith(('http', 'www', '<', '{', '/*', '*/')):
                    texts.add(s)

with open(os.path.join(os.path.dirname(__file__), 'strings_output_utf8.txt'), 'w', encoding='utf-8') as out:
    for t in sorted(texts):
        if not re.fullmatch(r'[0-9_\-]+', t):
            out.write(t + "\n")
