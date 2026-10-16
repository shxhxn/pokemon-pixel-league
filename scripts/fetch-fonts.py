"""Fetch Google Fonts CSS and its declared font URLs into local static assets."""
from pathlib import Path
from urllib.request import Request, urlopen
import re

root = Path('public/assets/fonts')
root.mkdir(parents=True, exist_ok=True)
url = 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap'
req = Request(url, headers={'User-Agent': 'Mozilla/5.0'})
css = urlopen(req).read().decode()
for index, remote in enumerate(dict.fromkeys(re.findall(r'url\((https://[^)]+)\)', css))):
    extension = remote.split('?')[0].rsplit('.', 1)[-1]
    local = f'font-{index}.{extension}'
    (root / local).write_bytes(urlopen(remote).read())
    css = css.replace(remote, f'/assets/fonts/{local}')
(root / 'fonts.css').write_text(css, encoding='utf-8')
(root / 'SOURCE.txt').write_text(url + '\nDM Sans and Space Mono by Google Fonts. SIL Open Font License 1.1.\n', encoding='utf-8')
for name, folder in [('DM-Sans', 'dmsans'), ('Space-Mono', 'spacemono')]:
    license_url = f'https://raw.githubusercontent.com/google/fonts/main/ofl/{folder}/OFL.txt'
    (root / f'{name}-OFL.txt').write_bytes(urlopen(license_url).read())
print('Downloaded local font files, stylesheet, and licenses.')
