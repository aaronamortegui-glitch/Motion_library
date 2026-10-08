# SS Motion Library

Librería de motion de Superside para After Effects, pensada para que **un LLM (Claude u otro) la use localmente para manejar AE**: aplicar animaciones, probarlas, renderizar y ampliar el catálogo. Todo lo que crea son keyframes y expresiones nativas, sin plugins.

## Cómo se ve

Miniaturas de 240 px (el catálogo completo está en `library/index.html`).

| Categoría | Ejemplo | Ejemplo | Para qué |
|---|---|---|---|
| **Motion** — entradas y salidas | ![Scale Pop](library/gifs/motion/scale-pop.gif) `Scale Pop` | ![Line Draw](library/gifs/motion/line-draw.gif) `Line Draw` | Íconos, chips, cards, líneas |
| **Effects** — loops continuos | ![Float](library/gifs/fx/float.gif) `Float` | ![Jitter](library/gifs/fx/jitter.gif) `Jitter` | Elementos en reposo, piezas de alta energía |
| **Texto** — por carácter o palabra | ![Chars Rise](library/gifs/text/chars-rise.gif) `Chars Rise` | ![Tracking Settle](library/gifs/text/tracking-settle.gif) `Tracking Settle` | Titulares, kickers, subtítulos |
| **Recetas** — comportamiento cosechado de Animation Composer y reproducido con nuestro código | ![2JV](library/gifs/recipe/calibration-2jv.gif) `2JV` pop con rebote | ![4VW](library/gifs/recipe/calibration-4vw.gif) `4VW` caída con rebote | Ampliar el catálogo con referencias reales |

Cada preset tiene **energía** (`suave`, `medio`, `dinámico`) para elegir según la pieza: social/hype → dinámico, corporativo/UI → suave.

## Cómo funciona

```
tokens (tiempos y curvas) ──► ss_motion_lib.jsx (SSM.animate) ──► ss_presets.jsx (SSP.apply / applyFx / applyText / applyRecipe)
                                                                        │
            LLM ──► bridge/inbox/*.jsx ──► AE (ss_bridge.jsx) ──► bridge/outbox/*.txt   (aplicar, probar, renderizar)
                                                                        │
                                       library/INDEX.txt  ◄── lo único que el LLM lee (~1 línea por preset)
```

- **`tokens/superside_motion_tokens.json`**: 6 duraciones (Tick 4f … Stage 33f) y 7 curvas (Flat, Land, Launch, Settle, Cruise, Pop, Recoil), calibradas con transiciones reales.
- **`library/INDEX.txt`**: índice ultracompacto `tipo|nombre|canales|energía|uso`. Un LLM lo lee completo con muy pocos tokens; el HTML y los GIF son solo para humanos.

## Para el LLM (Claude Code)

La skill `.claude/skills/ss-motion-library` explica todo. Lo esencial:

```bash
bash tools/bridge.sh tools/<job>.jsx      # ejecuta un .jsx en AE y devuelve OK/ERROR con línea (arranca el puente si hace falta)
```
```js
#include "ss_presets.jsx"   // el job vive en tools/ (o usa la ruta a tools/ss_presets.jsx)
(function () {
    var L = app.project.activeItem.layer("Titulo");
    SSP.applyText(L, "Chars Rise", "both");
    return "ok";
})();
```

## Ampliar la librería con Animation Composer (sin tocar el plugin)

Animation Composer no tiene API de script y sus presets están cifrados: **no se descifra ni se modifica**. Se automatiza su interfaz, como lo haría una persona, y se observa el resultado.

1. **AE:** *File › Scripts › Run Script File…* → `tools/ss_harvest_station.jsx`. Elige la sección y pulsa **Iniciar**.
2. **Panel de Animation Composer:** abre esa misma carpeta.
3. **Controlador** (solo la primera vez: `python tools/ac_driver.py calibrate`, con F8 sobre tres miniaturas):
   ```bash
   python tools/ac_driver.py run
   ```
   Hace doble clic miniatura por miniatura, espera a que la estación registre cada preset (receta, curvas y nombre), hace scroll y termina solo. ESC detiene.
4. **Integrar a la librería** (OCR de nombres → recetas → miniaturas → índice):
   ```bash
   bash tools/expand_library.sh
   ```

Las recetas guardan *qué se mueve y cómo* (canales relativos, frames, curva o frecuencia/amplitud) y `SSP.applyRecipe` lo reproduce con keyframes propios. Si una curva coincide con un token, se usa el token.

> Animation Composer es software licenciado de Mister Horse. Las cosechas (`research/harvest/`) son referencia de uso interno; no se redistribuyen presets ni renders del plugin.

## Para diseñadores

- **Panel:** `tools/ss_panel.jsx` → selecciona capas → preset → Aplicar (pestañas Motion / Effects, filtro por energía, escalonado).
- **Visualizador:** `library/index.html`.

## Estructura

| Carpeta | Contenido |
|---|---|
| `tokens/` | Tiempos y curvas |
| `tools/` | Librería JSX, panel, puente, estación de cosecha, controlador, pipelines (`expand_library.sh`, `render_gifs.sh`, `render_queue.jsx`) |
| `library/` | `INDEX.txt` (LLM), `library.json`, `recipes.json`, `index.html`, `gifs/` |
| `assets/` | Logos Superside, S-mark para AE, paleta y componentes del Figma *Essentials* |
| `ae/` | Proyecto de pruebas (incluye tracking y texto sobre video AI) |
| `media/` | Video base (Flora, 70s 16mm) y datos de tracking |
| `research/` | Calibración, cosechas, catálogo de previews |

## Requisitos

Windows · After Effects 2026 · Python 3 con `numpy`, `opencv-python`, `scipy`, `Pillow` · `ffmpeg` en el PATH · Git LFS.
El repo se puede clonar en cualquier carpeta: los scripts calculan la raíz (`SS_ROOT`) desde su propia ubicación. Ejecuta los `.jsx` desde `tools/` (no los copies a la carpeta *ScriptUI Panels* de AE).

## Notas

- `render_gifs.sh` usa `aerender` solo sin `SKIP_RENDER`. Si el proyecto tiene capas con presets de Animation Composer, renderiza con `tools/render_queue.jsx` (cola del AE abierto), porque `aerender` se queda colgado.
- `aaron.png` y el video de `media/` son material personal de prueba; revísalos antes de publicar el repo fuera del equipo.
- Fuentes de marca: Inter Tight e Instrument Serif (OFL), pendientes de instalar en `assets/fonts/`.
