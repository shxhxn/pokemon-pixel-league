"""Reuse the established motion-sheet packing pipeline for two practice unlocks."""
from pathlib import Path
import json

pipeline = Path('scripts/prepare-motion.py').read_text(encoding='utf-8')
namespace = {}
exec(pipeline.split("for file in ['LICENSE.md'")[0], namespace)
manifest_path = Path('public/assets/motion/manifest.json')
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
for partner in [{'id':403,'name':'Shinx'},{'id':447,'name':'Riolu'}]:
    data = namespace['prepare'](partner)
    manifest['pokemon'] = [p for p in manifest['pokemon'] if p['id'] != partner['id']] + [data]
    namespace['fetch'](f"https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/{partner['id']}.png",Path(f"public/assets/pokemon/{partner['id']}.png"))
    with Path('public/assets/motion/credits.txt').open('a',encoding='utf-8') as credits:
        credits.write(f"\n#{partner['id']} {partner['name']}\n{data['sourceDirectory']}\n{data['credits']}\n")
    print(partner['name'] + ': motion assets and attribution prepared', flush=True)
manifest['pokemon'].sort(key=lambda p:p['id'])
manifest_path.write_text(json.dumps(manifest,indent=2),encoding='utf-8')
