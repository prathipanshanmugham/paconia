"""Renders the 3D product stills used on cards and the home page (public/mockups/<slug>.webp).

Run the app first, then:
    pip install playwright pillow && playwright install chromium
    python3 scripts/render_mockups.py http://localhost:3000 [slug,slug,...]
New products show a simple drawing until a still exists. Real photos added in Desk > Catalogue always win.
"""
import asyncio, base64, io, os, sys
from playwright.async_api import async_playwright
from PIL import Image

BASE = sys.argv[1].rstrip('/') if len(sys.argv) > 1 else 'http://localhost:3000'
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'mockups')
DEFAULT = 'product-labels,die-cut-stickers,sticker-sheets,product-boxes,box-sleeves,hang-tags,thank-you-cards,printed-pouches,business-cards,invitations,acrylic-signs,cake-toppers,leather-tags,wood-coasters'
SLUGS = (sys.argv[2] if len(sys.argv) > 2 else DEFAULT).split(',')

async def main():
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        ctx = await b.new_context(viewport={'width': 800, 'height': 600}, device_scale_factor=2)
        for s in SLUGS:
            pg = await ctx.new_page()
            await pg.goto(f'{BASE}/render/{s}', wait_until='networkidle', timeout=180000)
            try:
                await pg.wait_for_function('window.__ready === true', timeout=120000)
            except Exception:
                print(s, 'did not render'); await pg.close(); continue
            data = await pg.evaluate("document.querySelector('canvas').toDataURL('image/png')")
            im = Image.open(io.BytesIO(base64.b64decode(data.split(',')[1]))).convert('RGBA').resize((1200, 900), Image.LANCZOS)
            path = os.path.join(OUT, f'{s}.webp'); im.save(path, 'WEBP', quality=82, method=6)
            print(s, os.path.getsize(path) // 1024, 'KB'); await pg.close()
        await b.close()

asyncio.run(main())
