"""Pack exported RGBA frames into 2-second playback previews (requires Pillow)."""
from pathlib import Path
from PIL import Image

base = Path(__file__).resolve().parents[1] / 'client/assets/skills/pisces/portal-export'
for level in (2, 3, 4):
    preview = []
    for number in range(1, 49):
        with Image.open(base / f'lv{level}-frames/{number:02}.png') as source:
            frame = source.convert('RGBA')
        assert frame.size == (640, 220)
        background = Image.new('RGBA', frame.size, '#192e4a')
        background.alpha_composite(frame)
        preview.append(background.convert('RGB'))
    preview[0].save(base / f'lv{level}-preview.gif', save_all=True,
                    append_images=preview[1:], duration=[40, 40, 40, 40, 40, 50] * 8,
                    loop=0)
print('3 playback GIFs packed from the exported 48-frame sequences')
