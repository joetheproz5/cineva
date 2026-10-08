# iOS PWA startup artwork

`startup-theme.json` is the shared source for the launch background and SEVEN mark placement. Generate the PNG launch images and the matching in-app CSS theme with:

```powershell
python -m pip install Pillow
python Web/scripts/generate_ios_splash.py
python Web/scripts/generate_ios_splash.py --check
```

The script reads each device point size, pixel ratio, orientation, and output path from the `apple-touch-startup-image` links in `index.html`; the media queries there are the source of truth. The in-app `<picture>` uses the exact same PNG for each matching media query, stretched only to its matching full-screen viewport, so the native launch frame and web handoff share identical logo pixels, center, background, and safe-area treatment. Unsupported sizes fall back to the centered wordmark over the shared CSS background.

For each table row with CSS width `W`, height `H`, and pixel ratio `DPR`, the portrait query is `(device-width: Wpx) and (device-height: Hpx) and (-webkit-device-pixel-ratio: DPR) and (orientation: portrait)`. The landscape query swaps `W` and `H` and uses `orientation: landscape`. For example, the new 440×956 @3x and 420×912 @3x variants map to 1320×2868 and 1260×2736 PNGs. Apple lists 2868×1320 pixels for [iPhone 17 Pro Max](https://support.apple.com/en-us/125091) and 2736×1260 for [iPhone Air](https://support.apple.com/en-us/125092).

| Device CSS size | DPR | Portrait PNG | Landscape PNG |
| --- | ---: | ---: | ---: |
| 440×956 | 3 | 1320×2868 | 2868×1320 |
| 430×932 | 3 | 1290×2796 | 2796×1290 |
| 428×926 | 3 | 1284×2778 | 2778×1284 |
| 420×912 | 3 | 1260×2736 | 2736×1260 |
| 414×896 | 3 | 1242×2688 | 2688×1242 |
| 414×896 | 2 | 828×1792 | 1792×828 |
| 402×874 | 3 | 1206×2622 | 2622×1206 |
| 393×852 | 3 | 1179×2556 | 2556×1179 |
| 390×844 | 3 | 1170×2532 | 2532×1170 |
| 375×812 | 3 | 1125×2436 | 2436×1125 |
| 375×667 | 2 | 750×1334 | 1334×750 |
| 1024×1366 | 2 | 2048×2732 | 2732×2048 |
| 834×1194 | 2 | 1668×2388 | 2388×1668 |
| 768×1024 | 2 | 1536×2048 | 2048×1536 |

The 440×956 @3x Pro Max-size and 420×912 @3x Air entries cover the current large iPhone point-size classes. iOS can retain the launch image created at install time; after deployment, delete and re-add the Home Screen app from Safari to refresh its cached launch image before cold-launch testing.
