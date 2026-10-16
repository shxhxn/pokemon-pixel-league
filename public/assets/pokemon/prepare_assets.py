"""Reproduce the local pixel roster from the attributed upstream sprite repository."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import hashlib
import io
import json
import math
import urllib.request
from PIL import Image, ImageSequence

ROOT = Path(__file__).resolve().parent
BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white'
ROSTER = {
    1:'Bulbasaur',4:'Charmander',7:'Squirtle',25:'Pikachu',26:'Raichu',
    39:'Jigglypuff',52:'Meowth',54:'Psyduck',58:'Growlithe',63:'Abra',
    66:'Machop',74:'Geodude',77:'Ponyta',79:'Slowpoke',92:'Gastly',
    94:'Gengar',104:'Cubone',113:'Chansey',123:'Scyther',129:'Magikarp',
    131:'Lapras',133:'Eevee',134:'Vaporeon',135:'Jolteon',136:'Flareon',
    143:'Snorlax',147:'Dratini',149:'Dragonite',150:'Mewtwo',151:'Mew',
    152:'Chikorita',155:'Cyndaquil',158:'Totodile',196:'Espeon',197:'Umbreon',
    282:'Gardevoir',448:'Lucario',658:'Greninja',
}

def fetch(url):
    request = urllib.request.Request(url, headers={'User-Agent':'PokemonPixelLeague-AssetPreparation/1.0'})
    with urllib.request.urlopen(request, timeout=45) as response:
        return response.read()

def prepare(item):
    pokemon_id, name = item
    png_url = f'{BASE}/{pokemon_id}.png'
    gif_url = f'{BASE}/animated/{pokemon_id}.gif'
    raw = fetch(png_url)
    image = Image.open(io.BytesIO(raw)).convert('RGBA')
    assert image.getbbox(), f'Empty sprite: {name}'
    (ROOT/f'{pokemon_id}.png').write_bytes(raw)
    animation = fetch(gif_url)
    (ROOT/f'{pokemon_id}.gif').write_bytes(animation)
    gif = Image.open(io.BytesIO(animation))
    frames, durations = [], []
    for frame in ImageSequence.Iterator(gif):
        frames.append(frame.convert('RGBA').copy())
        durations.append(frame.info.get('duration', 100))
    # Preserve each animation's relative motion; fit the union of its opaque
    # bounds in a consistent 96px cell and place its lowest pixel at y=90.
    bounds = [frame.getbbox() for frame in frames if frame.getbbox()]
    box = (min(b[0] for b in bounds), min(b[1] for b in bounds),
           max(b[2] for b in bounds), max(b[3] for b in bounds))
    width, height = box[2]-box[0], box[3]-box[1]
    scale = min(1, 88/width, 88/height)
    out_width, out_height = max(1,round(width*scale)), max(1,round(height*scale))
    columns = min(8, len(frames))
    sheet = Image.new('RGBA', (96*columns, 96*math.ceil(len(frames)/columns)))
    for index, frame in enumerate(frames):
        sprite = frame.crop(box)
        if scale < 1:
            sprite = sprite.resize((out_width,out_height), Image.Resampling.NEAREST)
        sheet.paste(sprite, (96*(index%columns)+(96-out_width)//2,
                            96*(index//columns)+90-out_height))
    sheet.save(ROOT/f'{pokemon_id}-sheet.png', optimize=True)
    entry = {'id':pokemon_id, 'name':name,
             'image':f'/assets/pokemon/{pokemon_id}.png',
             'gif':f'/assets/pokemon/{pokemon_id}.gif',
             'sheet':f'/assets/pokemon/{pokemon_id}-sheet.png',
             'frameWidth':96, 'frameHeight':96, 'frameCount':len(frames),
             'columns':columns, 'frameRate':round(1000*len(frames)/sum(durations),3),
             'frameDurationsMs':durations,
             'source':png_url, 'animationSource':gif_url,
             'sourceSha256':hashlib.sha256(raw).hexdigest(),
             'animationSourceSha256':hashlib.sha256(animation).hexdigest(),
             'artwork':'Smogon community Gen V style fan sprite' if pokemon_id>650 else 'Official Pokemon Black/White sprite',
             'license':'Proprietary Pokemon character artwork; see ASSETS.md; no blanket artwork license asserted'}
    print(f'{pokemon_id} {name}: {len(frames)} frames', flush=True)
    return entry

if __name__ == '__main__':
    ROOT.mkdir(parents=True,exist_ok=True)
    with ThreadPoolExecutor(max_workers=6) as pool:
        entries = list(pool.map(prepare, ROSTER.items()))
    manifest = {'version':1, 'sourceRepository':'https://github.com/PokeAPI/sprites',
                'preparedDate':'2026-10-13', 'frameWidth':96, 'frameHeight':96,
                'licenseNotice':'Pokemon artwork and character names belong to their respective rights holders. Source package ISC metadata does not grant rights to underlying Pokemon artwork. See ASSETS.md.',
                'pokemon':entries}
    (ROOT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
    print(f'Prepared {len(entries)} local sprites and animation sheets.')
