"""Bundle actual pixel fonts and their licenses for offline event use."""
from pathlib import Path
from urllib.request import Request, urlopen
import re

root = Path('public/assets/fonts')
url = 'https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@400;500;600;700&family=Press+Start+2P&display=swap'
css = urlopen(Request(url, headers={'User-Agent': 'Mozilla/5.0'})).read().decode()
for index, remote in enumerate(dict.fromkeys(re.findall(r'url\((https://[^)]+)\)', css))):
    extension = remote.split('?')[0].rsplit('.', 1)[-1]
    local = f'pixel-{index}.{extension}'
    (root / local).write_bytes(urlopen(remote).read())
    css = css.replace(remote, f'/assets/fonts/{local}')
(root / 'pixel-fonts.css').write_text(css, encoding='utf-8')
for family, folder in [('Pixelify-Sans', 'pixelifysans'), ('Press-Start-2P', 'pressstart2p')]:
    (root / f'{family}-OFL.txt').write_bytes(urlopen(f'https://raw.githubusercontent.com/google/fonts/main/ofl/{folder}/OFL.txt').read())
(root / 'PIXEL-SOURCES.txt').write_text(url + '\nGoogle Fonts / SIL Open Font License 1.1\n', encoding='utf-8')
print('Pixel fonts and licenses downloaded locally.')
