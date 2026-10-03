"""Split and verify the generated Cancer, Cetus and Pisces 24-frame VFX.

The committed `source` images are the artwork. This script only registers cells,
cleans invisible alpha noise, and exports sheets, individual frames and previews.
"""
from pathlib import Path
import hashlib
import json
import math

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
KINDS = ('attack', 'skill-lv2', 'skill-lv3', 'skill-lv4')
STARS = ('cancer', 'cetus', 'pisces')
SIZE = 256


def premultiply(frame):
    pixels = np.asarray(frame, dtype=np.float32) / 255
    pixels[:, :, :3] *= pixels[:, :, 3:4]
    return pixels


def from_premultiplied(pixels):
    result = pixels.copy()
    result[:, :, :3] /= np.maximum(result[:, :, 3:4], 1e-7)
    result[result[:, :, 3] < 1 / 255] = 0
    return Image.fromarray(np.clip(np.rint(result * 255), 0, 255).astype('uint8'), 'RGBA')


def registered(frame):
    # Transparent fringes are an export artifact, not part of the painting.
    pixels = np.array(frame.convert('RGBA'))
    pixels[pixels[:, :, 3] <= 4] = 0
    # Every cell shares its source-grid center. Soft mask keeps the first/last
    # pixel of a cell clear so adjacent animation cells never bleed together.
    ramp = np.minimum.reduce(np.broadcast_arrays(
        np.arange(SIZE)[:, None], np.arange(SIZE)[None, :],
        (SIZE - 1 - np.arange(SIZE))[:, None],
        (SIZE - 1 - np.arange(SIZE))[None, :]))
    pixels[:, :, 3] = np.rint(pixels[:, :, 3] * np.clip(ramp / 5, 0, 1)).astype('uint8')
    pixels[pixels[:, :, 3] == 0, :3] = 0
    return Image.fromarray(pixels, 'RGBA')


def build(star, kind):
    folder = ROOT / 'client/assets/skills' / star
    source_path = folder / 'source' / f'{kind}.png'
    source = Image.open(source_path).convert('RGBA')
    assert source.size == (SIZE * 6, SIZE * 4), (source_path, source.size)
    frames = [registered(source.crop(((n % 6) * SIZE, (n // 6) * SIZE,
                                      (n % 6 + 1) * SIZE, (n // 6 + 1) * SIZE)))
              for n in range(24)]
    # The generated artwork has a consistent 6x4 layout. A small temporal
    # filter of the middle loop damps frame-to-frame paint flicker, while
    # preserving the first/last stages exactly as designed.
    if kind != 'attack':
        middle = [premultiply(frame) for frame in frames[6:18]]
        for n in range(12):
            frames[n + 6] = registered(from_premultiplied(
                .15 * middle[(n-1) % 12] + .70 * middle[n] + .15 * middle[(n+1) % 12]))
    target = folder / kind / 'frames'
    target.mkdir(parents=True, exist_ok=True)
    for n, frame in enumerate(frames, 1):
        frame.save(target / f'{n:02d}.png', optimize=True)
    sheet = Image.new('RGBA', source.size)
    for n, frame in enumerate(frames):
        sheet.paste(frame, ((n % 6) * SIZE, (n // 6) * SIZE))
    sheet.save(folder / f'{kind}.png', optimize=True)
    frames[11].resize((128, 128), Image.Resampling.LANCZOS).save(folder / f'{kind}-icon.png')
    sequence = list(range(6)) + list(range(6, 18)) * 4 + list(range(18, 24))
    preview = [frames[n] for n in sequence]
    preview[0].save(folder / f'{kind}-preview.png', save_all=True,
                    append_images=preview[1:], duration=[83, 83, 84] * 20,
                    loop=0, disposal=0, blend=0, optimize=False)
    # Reopen export and inspect alpha, frame order, unique pixels and loop
    # seam. The APNG is an actual playable sequence, not a static contact sheet.
    saved = Image.open(folder / f'{kind}.png')
    assert saved.mode == 'RGBA' and saved.size == source.size
    assert len({frame.tobytes() for frame in frames}) == 24
    assert all(np.array(frame)[[0, -1], :, 3].max() == 0 and
               np.array(frame)[:, [0, -1], 3].max() == 0 for frame in frames)
    assert all(np.array_equal(np.array(saved.crop(((n % 6) * SIZE, (n // 6) * SIZE,
                                                  (n % 6 + 1) * SIZE, (n // 6 + 1) * SIZE))),
                              np.array(frame)) for n, frame in enumerate(frames))
    animated = Image.open(folder / f'{kind}-preview.png')
    assert animated.n_frames == 60
    for n, expected in enumerate(preview):
        animated.seek(n)
        assert np.array_equal(np.array(animated.convert('RGBA')), np.array(expected))
    seam = float(np.mean(np.abs(premultiply(frames[17]) - premultiply(frames[6]))))
    return {'sourceSha256': hashlib.sha256(source_path.read_bytes()).hexdigest(),
            'frames': 24, 'distinctFrames': 24, 'canvas': [SIZE, SIZE],
            'transparentBorders': True, 'playablePreviewFrames': 60,
            'loopSeamMeanDifference': round(seam, 5)}


def main():
    for star in STARS:
        results = {kind: build(star, kind) for kind in KINDS}
        folder = ROOT / 'client/assets/skills' / star
        (folder / 'manifest.json').write_text(json.dumps({
            'format': 'RGBA PNG', 'columns': 6, 'rows': 4, 'frameCount': 24,
            'frameWidth': SIZE, 'frameHeight': SIZE, 'frameOrder': 'row-major',
            'loopFrames': [7, 18], 'buildScript': 'scripts/build-water-vfx.py',
            'assets': results}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print(star, {kind: result['loopSeamMeanDifference'] for kind, result in results.items()})


if __name__ == '__main__':
    main()
