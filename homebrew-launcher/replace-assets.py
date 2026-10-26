"""Regenerate the launcher's packed menu artwork from source images.

Usage: python3 homebrew-launcher/replace-assets.py [background] [logo]

Defaults to assets-src/background.png and assets-src/logo.png beside this file.
The background is center-cropped to 16:9 and resized to the exact 1920x1080
render target; the logo plate is resized to its exact on-screen footprint of
440x220 (the shader samples both 1:1, so there is no in-shader filtering).

Outputs (raw RGBA, row-major, top-left origin):
  shaders/launcher-bg.bin    1920*1080*4 bytes, buffer byte 0x7f2000
  shaders/launcher-logo.bin  440*220*4 bytes, immediately after the background
plus PNG previews (shaders/launcher-bg.png, shaders/launcher-logo.png) so you
can eyeball exactly what will be uploaded. Do not edit the .bin files by hand;
the offsets are shared with shaders/launcher.frag and launcher.cjs.
"""
import sys
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent
BG_W, BG_H = 1920, 1080
PLATE_W, PLATE_H = 440, 220

def pack(image: Image.Image, size: tuple[int, int], out_bin: Path, out_png: Path) -> None:
    image = image.convert('RGBA')
    src_aspect, dst_aspect = image.width / image.height, size[0] / size[1]
    if abs(src_aspect - dst_aspect) > 1e-3:
        # Center-crop to the target aspect ratio before resizing.
        if src_aspect > dst_aspect:  # too wide: crop width
            crop_w, crop_h = round(image.height * dst_aspect), image.height
        else:                        # too tall: crop height
            crop_w, crop_h = image.width, round(image.width / dst_aspect)
        left, top = (image.width - crop_w) // 2, (image.height - crop_h) // 2
        image = image.crop((left, top, left + crop_w, top + crop_h))
    image = image.resize(size, Image.Resampling.LANCZOS)
    out_bin.write_bytes(image.tobytes())
    image.save(out_png)
    print(f'{out_bin.name}: {size[0]}x{size[1]} RGBA ({out_bin.stat().st_size} bytes), preview {out_png.name}')

def main() -> None:
    bg_src = Path(sys.argv[1]) if len(sys.argv) > 1 else root / 'assets-src' / 'background.png'
    logo_src = Path(sys.argv[2]) if len(sys.argv) > 2 else root / 'assets-src' / 'logo.png'
    pack(Image.open(bg_src), (BG_W, BG_H), root / 'shaders' / 'launcher-bg.bin', root / 'shaders' / 'launcher-bg.png')
    pack(Image.open(logo_src), (PLATE_W, PLATE_H), root / 'shaders' / 'launcher-logo.bin', root / 'shaders' / 'launcher-logo.png')

if __name__ == '__main__':
    main()
