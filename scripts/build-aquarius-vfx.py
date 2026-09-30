"""Assemble generated Aquarius artwork. No drawing or image-generation fallback.

Requires Pillow and numpy. Run from any directory; inputs are committed source PNGs.
Only writes client/assets/skills/aquarius and optional private .local QA material.
"""
from pathlib import Path
import hashlib
import json
import math

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'client/assets/skills/aquarius'
QA = ROOT / '.local/aquarius-vfx'
KINDS = ['attack', 'skill-lv2', 'skill-lv3', 'skill-lv4']
SIZE = 256
YY, XX = np.mgrid[:SIZE, :SIZE]


def rgba(a):
    return Image.fromarray(np.clip(np.rint(a), 0, 255).astype('uint8'))


def premul(im):
    a = np.asarray(im, dtype=np.float32) / 255
    a[..., :3] *= a[..., 3:4]
    return a


def unpremul(a):
    b = a.copy()
    b[..., :3] /= np.maximum(b[..., 3:4], 1e-8)
    b[b[..., 3] < 0.5 / 255] = 0
    return rgba(b * 255)


def clean(im):
    a = np.array(im.convert('RGBA'))
    # Already real alpha, not color-key removal. Drop only <=3/255 export noise.
    a[a[..., 3] <= 3] = 0
    return rgba(a)


def transform(im, sx, sy, cx, cy, tx, ty):
    return im.transform((256, 256), Image.Transform.AFFINE,
                        (1/sx, 0, cx-tx/sx, 0, 1/sy, cy-ty/sy),
                        Image.Resampling.BICUBIC)


def centroid(im):
    a = np.asarray(im, dtype=np.float64)[..., 3] ** 2
    return (float((a*XX).sum()/a.sum()), float((a*YY).sum()/a.sum()))


def floor_bounds(im):
    a = np.asarray(im, dtype=np.float64)
    mask = (a[..., 3] > 65) & (a[..., 2] > a[..., 0]*1.1) & (YY >= 205)
    widths = []
    for y in range(205, 250):
        xs = np.where(mask[y])[0]
        widths.append((int(xs[-1]-xs[0]+1) if len(xs) else 0, y))
    width, y = max(widths)
    xs = np.where(mask[y])[0]
    # Farthest horizontal tips belong to the floor ellipse, not the water column.
    cx = float(xs[0]+xs[-1])/2
    return cx, float(y), float(width)


def export_frames(kind):
    source = Image.open(OUT / 'source' / f'{kind}.png').convert('RGBA')
    assert source.size == (1536, 1024), (kind, source.size)
    raw = [clean(source.crop(((i%6)*256, (i//6)*256,
                              (i%6+1)*256, (i//6+1)*256))) for i in range(24)]
    registration = []
    if kind == 'attack':
        aligned = []
        for im in raw:
            cx, cy = centroid(im)
            aligned.append(transform(im, .84, .84, cx, cy, 128, 128))
            registration.append({'sourceCenter': [cx, cy], 'scale': [.84, .84]})
    else:
        # One global horizontal scale: ring body ~80% of native 256px canvas.
        canonical = floor_bounds(raw[9])
        sx = 205 / canonical[2]
        aligned = []
        for im in raw:
            cx, cy, width = floor_bounds(im)
            aligned.append(transform(im, sx, .78, cx, cy, 128, 192))
            registration.append({'sourceFloor': [cx, cy], 'sourceFloorWidth': width,
                                 'scale': [sx, .78]})
    p = [premul(im) for im in aligned]
    if kind != 'attack':
        # Reuse the actual generated jar and ground ellipse from frame 10.
        # Freeze identity/camera drift; animated water survives between these bands.
        top = np.clip((116-YY)/12, 0, 1)
        floor = np.clip((YY-174)/12, 0, 1)
        lock = np.maximum(top, floor)[..., None]
        for i in range(6, 18):
            p[i] = p[i]*(1-lock) + p[9]*lock
    # Circular temporal filtering of generated water frames, premultiplied-alpha.
    # Equal treatment of all edges including 18->7 avoids a special reset frame.
    loop = p[6:18]
    p[6:18] = [.25*loop[(i-1)%12] + .5*loop[i] + .25*loop[(i+1)%12]
               for i in range(12)]
    # Smooth the startup/tail into exactly the loop endpoints.
    for i in range(6):
        mix = (i/5)**2
        p[i] = (p[i]*(1-mix) + p[6]*mix) * [.06, .18, .38, .62, .84, .995][i]
    for i in range(6):
        mix = (i/5)**1.4
        p[18+i] = (p[17]*(1-mix) + p[18+i]*mix) * [.995, .85, .63, .39, .16, 0][i]
    # Transparent padded borders; fade only the outermost 5px if a source particle touches.
    edge = np.clip(np.minimum.reduce([XX, YY, 255-XX, 255-YY])/5, 0, 1)[..., None]
    frames = [clean(unpremul(a*edge)) for a in p]
    if kind == 'attack':
        for i, im in enumerate(frames):
            if i != 23:
                cx, cy = centroid(im)
                frames[i] = clean(transform(im, 1, 1, cx, cy, 128, 128))
    return frames, registration


def validate(kind, frames, folder, registration, sequence, durations):
    sheet = Image.open(OUT/f'{kind}.png')
    assert sheet.mode == 'RGBA' and sheet.size == (1536, 1024)
    assert len(frames) == 24 and all(im.size == (256, 256) and im.mode == 'RGBA' for im in frames)
    borders = []
    for i, im in enumerate(frames):
        a = np.array(im)
        borders.append(int(max(a[0,:,3].max(), a[-1,:,3].max(), a[:,0,3].max(), a[:,-1,3].max())))
        assert np.all(a[a[...,3] == 0, :3] == 0), 'Invisible RGB must be clean'
        assert np.array_equal(a, np.array(sheet.crop(((i%6)*256,(i//6)*256,(i%6+1)*256,(i//6+1)*256))))
    assert max(borders) == 0, (kind, borders)
    apng = Image.open(OUT/f'{kind}-preview.png')
    assert apng.is_animated and apng.n_frames == 60, (kind, apng.n_frames)
    timing = []
    for i in range(apng.n_frames):
        apng.seek(i)
        timing.append(apng.info['duration'])
        assert np.array_equal(np.array(apng.convert('RGBA')), np.array(frames[sequence[i]]))
    assert abs(sum(timing)-5000) < .1
    pa = [premul(im) for im in frames]
    diffs = [float(np.mean(np.abs(pa[6+i]-pa[6+(i+1)%12]))) for i in range(12)]
    result = {'frames':24, 'uniqueFrames':len({im.tobytes() for im in frames}),
              'canvas':[256,256], 'sheet':[1536,1024], 'alpha':'real RGBA; zero RGB at zero alpha',
              'transparentBorderMaxAlpha':max(borders), 'apngFrames':apng.n_frames,
              'apngDurationMs':sum(timing), 'apngEveryFrameMatchesPng':True,
              'loopPremultipliedMeanAbsDiff':diffs,
              'loopSeamMeanAbsDiff':diffs[-1],
              'sourceRegistration':registration}
    if kind == 'attack':
        centers = [centroid(f) for f in frames[:23]]
        result['alphaSquaredCentroids'] = centers
        result['maxCenterErrorPx'] = max(math.hypot(x-128,y-128) for x,y in centers)
        assert result['maxCenterErrorPx'] < .8
    else:
        a = [np.array(im) for im in frames[6:18]]
        result['loopJarRegionMaxPixelDifference'] = max(int(np.abs(im[:104].astype(int)-a[0][:104]).max()) for im in a)
        result['loopFloorRegionMaxPixelDifference'] = max(int(np.abs(im[186:].astype(int)-a[0][186:]).max()) for im in a)
        result['registeredFloorCenterPx'] = [128,192]
        result['referenceFloorBodyWidthPx'] = 205
        assert result['loopJarRegionMaxPixelDifference'] == 0
        assert result['loopFloorRegionMaxPixelDifference'] == 0
    return result


def main():
    QA.mkdir(parents=True, exist_ok=True)
    manifest = {'version':1, 'generator':'builtin image_gen.imagegen',
                'nativeSize':256, 'frameWidth':256, 'frameHeight':256,
                'columns':6, 'rows':4, 'frameCount':24, 'sheetWidth':1536, 'sheetHeight':1024,
                'frameOrder':'row-major', 'premultipliedAlpha':False,
                'prompts':'production-prompts.json',
                'buildScript':'scripts/build-aquarius-vfx.py',
                'previewDurationMs':5000,
                'phases':{'startup':{'frames':[0,5],'startMs':0,'endMs':500},
                          'loop':{'frames':[6,17],'startMs':500,'endMs':4500,'cycleMs':1000,'repeat':4},
                          'fade':{'frames':[18,23],'startMs':4500,'endMs':5000}},
                'assets':{}}
    sequence = list(range(6)) + list(range(6,18))*4 + list(range(18,24))
    durations = [83,83,84]*20
    reports = {}
    contact = Image.new('RGBA', (1024,512), (27,33,42,255))
    for col, kind in enumerate(KINDS):
        frames, registration = export_frames(kind)
        folder = OUT / kind / 'frames'
        folder.mkdir(parents=True, exist_ok=True)
        for i, im in enumerate(frames):
            im.save(folder/f'{i+1:02d}.png', optimize=True)
        sheet = Image.new('RGBA',(1536,1024))
        for i, im in enumerate(frames):
            sheet.paste(im, ((i%6)*256,(i//6)*256))
        sheet.save(OUT/f'{kind}.png', optimize=True)
        frames[9].resize((128,128),Image.Resampling.LANCZOS).save(OUT/f'{kind}-icon.png')
        anim = [frames[i] for i in sequence]
        anim[0].save(OUT/f'{kind}-preview.png', save_all=True, append_images=anim[1:],
                     duration=durations, loop=0, disposal=0, blend=0, optimize=False)
        anchor = [.5,.5] if kind=='attack' else [.5,.75]
        manifest['assets'][kind] = {'sourceKind':f'aquarius-{kind}', 'sheet':f'{kind}.png',
                                  'icon':f'{kind}-icon.png', 'preview':f'{kind}-preview.png',
                                  'framePattern':f'{kind}/frames/{{frame:02d}}.png',
                                  'frameFilenameIndexBase':1,'anchor':anchor,
                                  'nativeSize':256, 'frameCount':24,
                                  'groundEllipseWidthRatio':None if kind=='attack' else .80,
                                  'source':f'source/{kind}.png',
                                  'sourceSha256':hashlib.sha256((OUT/'source'/f'{kind}.png').read_bytes()).hexdigest()}
        reports[kind] = validate(kind, frames, folder, registration, sequence, durations)
        contact.alpha_composite(frames[9], (col*256,0))
        light = Image.new('RGBA',(256,256),(235,235,226,255))
        light.alpha_composite(frames[9])
        contact.paste(light,(col*256,256))
    (OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    report = {'reviewTool':'Codex; exact model not exposed by tool metadata',
              'checks':reports, 'apngFrameIndices':sequence, 'apngFrameDurationsMs':durations,
              'status':'structural checks passed; see playback-validation.json for browser playback'}
    (OUT/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    contact.save(QA/'contact-dark-light.png')
    print(json.dumps({k:{key:v for key,v in r.items() if key not in ['sourceRegistration','alphaSquaredCentroids','loopPremultipliedMeanAbsDiff']} for k,r in reports.items()},indent=2))


if __name__ == '__main__':
    main()
