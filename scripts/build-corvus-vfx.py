"""생성된 6×4 원화를 사용자 요청대로 분리·중심 정렬·PNG/APNG로 조립합니다.
Pillow 필요. 색/깃털 원화는 image_gen 결과를 그대로 사용합니다.
"""
from pathlib import Path
import json, math
from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parents[1] / 'client/assets/skills/corvus'
manifest = {'version': 1, 'tool': 'built-in image_gen + Pillow frame assembly', 'effects': []}
for name in ['attack', 'skill-lv2', 'skill-lv3', 'skill-lv4']:
    original = Image.open(ROOT / 'source' / (name + '.png')).convert('RGBA')
    assert original.size == (1536, 1024)
    size = 256 if name == 'attack' else 512
    frames, offsets = [], []
    folder = ROOT / 'frames' / name
    folder.mkdir(parents=True, exist_ok=True)
    for i in range(24):
        x, y = (i % 6) * 256, (i // 6) * 256
        cell = original.crop((x, y, x+256, y+256))
        # 회전하는 깃털 대신 중앙 발광점을 기준으로 정렬. 공격은 고정 셀 중심 유지.
        ox = oy = 0
        if name != 'attack':
            samples = []
            for py in range(102, 154):
                for px in range(102, 154):
                    r,g,b,a = cell.getpixel((px,py))
                    weight = max(0, min(r,g,b)-190) * a
                    if weight: samples.append((px,py,weight))
            total = sum(p[2] for p in samples)
            if total:
                ox = round(128 - sum(p[0]*p[2] for p in samples)/total)
                oy = round(128 - sum(p[1]*p[2] for p in samples)/total)
        aligned = Image.new('RGBA',(256,256))
        aligned.alpha_composite(cell,(ox,oy))
        # 반투명 잔상 가장자리를 정리하고 마지막 프레임은 완전히 소멸합니다.
        fade = 1 if i < 19 else (23-i)/4
        alpha = aligned.getchannel('A').point(lambda a: round(max(0,a-2)*255/253*fade))
        aligned.putalpha(alpha)
        # 전체 프레임에 동일 배율을 적용하여 상대 크기 변화와 중심축을 보존합니다.
        inner = round(size*.86)
        frame = Image.new('RGBA',(size,size))
        frame.alpha_composite(aligned.resize((inner,inner),Image.Resampling.LANCZOS),((size-inner)//2,(size-inner)//2))
        frames.append(frame); offsets.append([ox,oy])
        frame.save(folder/f'{i+1:02}.png',optimize=True)
    sheet=Image.new('RGBA',(size*6,size*4))
    for i,frame in enumerate(frames):sheet.alpha_composite(frame,((i%6)*size,(i//6)*size))
    sheet.save(ROOT/(name+'.png'),optimize=True)
    frames[12].resize((128,128),Image.Resampling.LANCZOS).save(ROOT/(name+'-icon.png'),optimize=True)
    # APNG는 GIF와 달리 반투명 빛을 보존하며 브라우저에서 실제 재생할 수 있습니다.
    frames[0].save(ROOT/(name+'-preview.apng'),save_all=True,append_images=frames[1:],duration=[42]*23+[350],loop=0,disposal=0,blend=0)
    assert frames[-1].getchannel('A').getbbox() is None
    assert all(f.getchannel('A').getpixel((0,0))==0 for f in frames)
    manifest['effects'].append({'id':name,'sourceSize':[1536,1024],'nativeFrameSize':256,'frameSize':size,
        'sheetSize':[size*6,size*4],'columns':6,'rows':4,'frameCount':24,'fps':24,'durationMs':1000,
        'anchor':[.5,.5],'alignmentOffsetsNativePixels':offsets,'resampling':'LANCZOS 256 to 512' if size==512 else 'none',
        'sheet':name+'.png','frames':'frames/'+name+'/{01..24}.png','preview':name+'-preview.apng'})
(ROOT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print('4 sheets / 96 separate RGBA frames / 4 APNG previews: generated and validated')
