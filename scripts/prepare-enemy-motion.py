"""Pack attributed enemy Walk, Hop and Hurt frames with the existing pipeline."""
from pathlib import Path
import json
from concurrent.futures import ThreadPoolExecutor
pipeline=Path('scripts/prepare-motion.py').read_text(encoding='utf-8')
namespace={}
exec(pipeline.split("for file in ['LICENSE.md'")[0],namespace)
foes=[(19,'rattata'),(16,'pidgey'),(41,'zubat'),(74,'geodude'),(92,'gastly'),(100,'voltorb'),(23,'ekans'),(93,'haunter'),(94,'gengar'),(95,'onix'),(125,'electabuzz')]
def build(foe):
    result=namespace['prepare']({'id':foe[0],'name':foe[1]})
    print(foe[1]+': animations ready',flush=True)
    return result
with ThreadPoolExecutor(max_workers=4) as pool: results=list(pool.map(build,foes))
Path('public/assets/enemies/motion.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
Path('public/assets/enemies/credits.txt').write_text('Enemy motion: https://github.com/PMDCollab/SpriteCollab\nContributed artwork: CC BY-NC 4.0; official Chunsoft/Pokemon rights retained.\nStatic portraits: https://github.com/PokeAPI/sprites\n\n'+'\n'.join(f"{p['name']}\n{p['sourceDirectory']}\n{p['credits']}" for p in results),encoding='utf-8')
