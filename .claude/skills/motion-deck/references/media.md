# Media: find what exists, encode, budget

## 1. Find before you make

1. Ask where the work lives and search it: `**/*.webm`, `**/*.mp4`, `**/*.mov`, renders folders, `previews/`,
   `library/gifs/`, case-study folders, the user's Downloads. In a Motion DNA clone, previews already exist as WebM,
   GIF and animated WebP under `library/` and `research/video_prompts/previews/`.
2. A WebM that is already VP9 and the right size is copied as is (`media.py` does this when `src` ends in `.webm`
   and no time range is given).
3. A GIF in a deck is a thumbnail of a video: find the original MP4 (compare a contact sheet of both) and encode
   that. GIFs band and pixelate in full screen.
4. Slides/PDF exports are low resolution: pull the original images, or the largest rendition the source offers.

## 2. `media.json`

```json
{
  "films":  [{"name": "teaser", "src": "C:/path/teaser.mp4", "poster_at": 18}],
  "loops":  [{"name": "loop_hero", "src": "C:/path/teaser.mp4", "start": 70, "dur": 7}],
  "stills": [{"name": "shot_1", "src": "C:/path/teaser.mp4", "at": 30},
             {"name": "portrait", "src": "C:/path/portrait.png"}]
}
```

`python media.py` writes `assets/` (full); `python media.py --lite` writes `assets_lite/` (email). Reference files
in the HTML as `assets/<name>.webm|.jpg`; the build swaps the folder for `--lite`.

## 3. Encode settings

| Kind | Full (present locally) | Lite (attach to email) |
|---|---|---|
| Film with sound | source resolution, VP9 `-crf 32`, Opus 96k | 960 px, `-crf 42-44`, Opus 48k |
| Loop (muted) | 1280 px, `-crf 34`, 6-8 s | 854 px, `-crf 40-42` |
| Still | JPEG q90, ≤1600 px | JPEG q80, ≤1100 px |
| Portrait / logo with alpha | PNG | PNG |

All video: `-c:v libvpx-vp9 -b:v 0 -row-mt 1 -deadline good -cpu-used 2 -pix_fmt yuv420p`. Look at one frame of every
encode before building.

## 4. Size budgets

- Base64 inlining adds a third; an email attachment adds another third. Gmail allows 25 MB, Outlook ~20 MB, so the
  **lite single file must stay under ~15 MB** (aim for 10-12). The full version can be 40-80 MB for local use.
- Rough lite budget: two 90-120 s films ≈ 7 MB, two loops ≈ 0.7 MB, fifteen stills ≈ 0.8 MB.
- Over budget: shorten loops, drop the film audio to 32k, lower film width to 854, or link the film instead.
- Email bodies cannot run the deck (no JavaScript, no video in Gmail/Outlook): attach the lite HTML, or put a GIF
  preview in the body that links to the full file in the user's own Drive.

## 5. Opening the file

Double-click the HTML: it opens in Chrome, Edge or Safari and works offline. Phone mail apps often show HTML
attachments as text; recommend a computer.
