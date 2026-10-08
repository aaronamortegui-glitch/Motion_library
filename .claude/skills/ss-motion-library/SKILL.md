---
name: ss-motion-library
description: Aplicar, ampliar y documentar la librería de motion propia de Superside (SS Motion) en After Effects desde este repo. Usar cuando se pida animar capas/textos con presets de Superside, elegir animaciones por energía (suave/medio/dinámico) o uso (social, corporativo, UI), crear un preset nuevo, cosechar presets de Animation Composer como referencia, o regenerar los GIF y el visualizador HTML.
---

# SS Motion Library

Librería propia de motion para After Effects. Todo crea keyframes/expresiones nativas (sin plugins).

## Piezas del repo
| Archivo | Qué es |
|---|---|
| `tokens/superside_motion_tokens.json` | Duraciones (Tick→Stage) y curvas (Flat, Land, Launch, Settle, Cruise, Pop, Recoil) |
| `tools/ss_motion_lib.jsx` | `SSM.animate(prop, t0, v0, v1, "<duración>", "<curva>")` — aplica tokens a cualquier propiedad |
| `tools/ss_presets.jsx` | `SSP.apply` (motion), `SSP.applyFx` (loops), `SSP.applyText` (texto) — metadatos de cada preset |
| `tools/ss_panel.jsx` | Panel ScriptUI para diseñadores |
| `library/INDEX.txt` | **Índice compacto para LLMs** (~500 tokens): lo único que hay que leer |
| `library/library.json` | Catálogo para herramientas (genera HTML/INDEX) |
| `library/index.html` | Visualizador con filtros |
| `bridge/` | Puente con AE: `.jsx` en `inbox/` → resultado en `outbox/<nombre>.txt` |

## Elegir un preset
Lee SOLO `library/INDEX.txt` (una línea por preset: `kind|nombre|canales|energía s/m/d|uso` + tokens en el encabezado).
No abras `index.html`, `library.json`, GIFs ni MP4 para decidir: son para humanos/herramientas y gastan contexto.
Reglas:
- Video dinámico / social → `energy: dinámico` (Scale Pop, Squash Warp, Jitter, Chars Pop) + escalonado `Tick`.
- Corporativo / explicativo / UI → `suave` (Fade, Fade Up, Blur In, Words Fade Up).
- Presentaciones / general → `medio`.
- Texto siempre con `SSP.applyText`; nunca `SSP.apply` sobre capas de texto si se quiere animación por carácter/palabra.

## Aplicar en AE (puente)
1. Escribe el job en `tools/` (para que los `#include` relativos funcionen), p. ej. `tools/_job_titulo.jsx`.
2. Ejecútalo: `bash tools/bridge.sh tools/_job_titulo.jsx` (arranca el puente si hace falta, espera y devuelve `OK`/`ERROR line N`). Borra el job al terminar.
```js
#include "ss_presets.jsx"
(function () {
    var c = app.project.activeItem;            // o busca la comp por nombre
    var L = c.layer("Titulo");
    SSP.applyText(L, "Chars Rise", "both");    // in + out
    return "ok";
})();
```
3. Render de verificación: por la cola de AE (`tools/render_queue.jsx` + `tools/wait_files.sh`) o `aerender` si el proyecto NO tiene capas de Animation Composer (con ellas `aerender` se cuelga). Revisa frames con ffmpeg (hoja de contacto con `tile`).

## Crear un preset nuevo
1. Agrégalo en `tools/ss_presets.jsx` (objeto `P`, `FX` o `TX`) con `channels`, `energy`, `use` e `in`/`out` usando solo `SSM.animate` con tokens.
2. `bash tools/expand_library.sh` → comps de miniatura, render (cola de AE), GIF, `library.json`, `index.html` e `INDEX.txt`.

## Ampliar con Animation Composer (solo comportamiento)
- Nunca descifrar `.mhcitem/.mhitemdata`, ni modificar la extensión, ni activar modos de depuración de CEP.
- Flujo: el usuario abre `tools/ss_harvest_station.jsx` en AE (sección + Iniciar) y la carpeta equivalente en el panel de AC → `python tools/ac_driver.py run` (UI automation: doble clic por miniatura, espera el registro en `research/harvest/station/_log.csv`, scroll, ESC para parar; calibrar antes con `calibrate`) → `bash tools/expand_library.sh` (OCR de nombres, `harvest_to_library.py` → `library/recipes.json`, miniaturas, índice).
- Las recetas se aplican con `SSP.applyRecipe(L, id, "both")`; reproducen el comportamiento con keyframes/expresiones propias.

## Trampas conocidas de ExtendScript
- Regex `/\\/g` rompe el parser → `.split("\\").join("/")`.
- `new File()` con `#` falla → `Folder.getFiles("Nombre*")`.
- Parentar por script conserva posición global → parentar primero, posicionar después.
- Propiedades con rango (selectores de texto ±100) → la lib ya hace clamp.
- Validar sintaxis: quitar `#include` y `node --check` sobre una copia `.js`.
- `rq.render()` no corre dentro de la tarea del puente → `render_queue.jsx` lo programa con `app.scheduleTask` y `wait_files.sh` espera los archivos.
- IDs de receta contienen `__`: el nombre de comp es `GIF__<tipo>__<resto>`, tomar todo lo que sigue al segundo `__`.
- Consola de Windows: exportar `PYTHONIOENCODING=utf-8` (los scripts ya lo hacen).
