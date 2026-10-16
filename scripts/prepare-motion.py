"""Build real side-facing locomotion sheets; preserve upstream credits and hashes."""
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.request import urlopen
from PIL import Image
import hashlib, io, json, math, xml.etree.ElementTree as ET

ROOT = Path('public/assets/motion')
ROOT.mkdir(parents=True, exist_ok=True)
BASE = 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/'
roster = json.loads(Path('public/assets/pokemon/manifest.json').read_text())['pokemon']

def fetch(url, target):
    if target.exists(): return target.read_bytes()
    data = urlopen(url, timeout=35).read()
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    return data

def prepare(p):
    pid = p['id']; origin = BASE + f'sprite/{pid:04d}/'; dest = ROOT/'sources'/str(pid)
    xml = fetch(origin+'AnimData.xml', dest/'AnimData.xml')
    credit = fetch(origin+'credits.txt', dest/'credits.txt').decode('utf-8')
    anims = {a.findtext('Name'): a for a in ET.fromstring(xml).findall('./Anims/Anim')}
    def resolve(names):
        name = next((n for n in names if n in anims), 'Walk')
        seen=set()
        while anims[name].findtext('CopyOf'):
            if name in seen: raise ValueError('Circular animation reference')
            seen.add(name);name=anims[name].findtext('CopyOf')
        return name,anims[name]
    states={}; allframes=[]; sources={}
    for state, candidates in [('idle',['Idle','Walk']),('run',['Walk']),('jump',['Hop','LeapForth','Jump','Walk']),('hurt',['Hurt','Pain','Idle']),('celebrate',['Pose','Nod','Idle'])]:
        name,a=resolve(candidates);fw=int(a.findtext('FrameWidth'));fh=int(a.findtext('FrameHeight'))
        raw=fetch(origin+name+'-Anim.png', dest/(name+'-Anim.png'))
        source=Image.open(io.BytesIO(raw)).convert('RGBA')
        durations=[int(t.text) for t in a.findall('./Durations/Duration')]
        count=len(durations);row=2 if source.height//fh>=8 else 0
        frames=[source.crop((i*fw,row*fh,(i+1)*fw,(row+1)*fh)) for i in range(count)]
        boxes=[im.getbbox() for im in frames if im.getbbox()]
        if not boxes: raise ValueError(f'{pid} {state}: blank animation')
        union=(min(b[0] for b in boxes),min(b[1] for b in boxes),max(b[2] for b in boxes),max(b[3] for b in boxes))
        # Normalize visible frames with one character-wide scale.
        base=len(allframes)
        for frame in frames:
            bbox=frame.getbbox()
            allframes.append(frame.crop(bbox) if bbox else Image.new('RGBA',(1,1)))
        states[state]={'frames':list(range(base,base+count)),'frameRate':12 if state=='run' else (10 if state in ['jump','hurt'] else 6),'sourceAnimation':name}
        sources[name]={'url':origin+name+'-Anim.png','sha256':hashlib.sha256(raw).hexdigest()}
    jump=states['jump']['frames']
    # Independent non-looping launch, falling pose, and landing recovery tracks.
    states['fall']={'frames':jump[max(0,len(jump)//2):],'frameRate':8,'sourceAnimation':states['jump']['sourceAnimation']}
    states['land']={'frames':jump[-min(3,len(jump)):],'frameRate':14,'sourceAnimation':states['jump']['sourceAnimation']}
    scale=min(2,80/max(max(frame.size) for frame in allframes))
    sheet=Image.new('RGBA',(96*8,96*math.ceil(len(allframes)/8)))
    for i,frame in enumerate(allframes):
        art=frame.resize((max(1,round(frame.width*scale)),max(1,round(frame.height*scale))),Image.Resampling.NEAREST)
        sheet.alpha_composite(art,((i%8)*96+(96-art.width)//2,(i//8)*96+90-art.height))
    sheet.save(ROOT/f'{pid}.png')
    return {'id':pid,'name':p['name'],'sheet':f'/assets/motion/{pid}.png','frameWidth':96,'frameHeight':96,'frameCount':len(allframes),'states':states,'sources':sources,'credits':credit,'sourceDirectory':origin,'modifications':'Extracted east-facing frames; per-frame transparent trim with uniform per-character nearest-neighbor scale; feet aligned in 96x96 cells; split hop sequence into airborne and landing states.'}

for file in ['LICENSE.md','credit_names.txt','README.md']:
    fetch(BASE+file,ROOT/('UPSTREAM-'+file))
results=[];errors=[]
with ThreadPoolExecutor(max_workers=6) as pool:
    jobs={pool.submit(prepare,p):p for p in roster}
    for f in as_completed(jobs):
        p=jobs[f]
        try:
            data=f.result();results.append(data);print(f'{p["name"]}: real Walk / {data["states"]["jump"]["sourceAnimation"]} / Hurt frames ready',flush=True)
        except Exception as e:errors.append((p['id'],str(e)));print(f'ERROR {p["name"]}: {e}',flush=True)
manifest={'source':'https://github.com/PMDCollab/SpriteCollab','license':'Upstream CC BY-NC 4.0 for contributed work; official Chunsoft artwork and Pokemon underlying rights remain relevant. See included upstream license and character credits.','pokemon':sorted(results,key=lambda p:p['id']),'errors':errors}
(ROOT/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
if errors:raise SystemExit(f'{len(errors)} incomplete characters: {errors}')
print(f'Prepared and attributed {len(results)} playable motion sets.')

credits=['POKEMON PIXEL LEAGUE - MOTION SPRITE CREDITS',
 'Source: https://github.com/PMDCollab/SpriteCollab',
 'Contributed work: CC BY-NC 4.0. See UPSTREAM-LICENSE.md.',
 'Official Chunsoft art and underlying Pokemon rights remain with their respective owners.',
 'Derived east-facing strips: per-frame trim, uniform nearest-neighbor scale, feet alignment, 96x96 cells.',
 'Fall and landing reuse subsets of Hop.', '']
for p in manifest['pokemon']:
 credits.extend([f"#{p['id']} {p['name']}",p['sourceDirectory'],p['credits'],''])
(ROOT/'credits.txt').write_text('\n'.join(credits),encoding='utf-8')
