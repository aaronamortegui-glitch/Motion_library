# Vendored open-source code

Small, permissively licensed libraries copied as published, never modified. Each one keeps its license file. The full
catalog of outside resources (and what was ruled out) is `library/resources.json` (MCP `list_resources`).

| Folder | What | Version | License | Source |
|---|---|---|---|---|
| `json2/json2.js` | `JSON.parse` / `JSON.stringify` for ExtendScript (ES3) | 2023-05-10 | Public Domain (file header) | https://github.com/douglascrockford/JSON-js |
| `ekeys/eKeys.jsx` | Keyframe-like animation written as an expression: `animate([{keyTime, keyValue, easeIn, easeOut}])` | 5.0.0 (release asset) | MIT (`ekeys/LICENSE`) | https://github.com/motiondeveloper/eKeys |
| `aefunctions/aefunctions.jsx` | Expression helpers: layer bounds and rects, padding, text size, responsive boxes | 2.0.3 (release asset) | MIT (`aefunctions/LICENSE`) | https://github.com/motiondeveloper/aefunctions |

## Use

- **json2** in a JSX job: `#include "../vendor/json2/json2.js"` (it does nothing where `JSON` already exists).
- **eKeys / aefunctions** are expression libraries: AE loads them as footage and expressions read them.
  `#include "ss_vendor.jsx"` then `SSV.expressionLib("eKeys")` imports the file (once) and returns the line to put
  at the top of an expression, for example:

  ```js
  const eKeys = footage("eKeys.jsx").sourceData;
  eKeys.animate([{ keyTime: 0, keyValue: [0, 0], easeOut: 66 }, { keyTime: 1, keyValue: [960, 540], easeIn: 90 }], time);
  ```

  Needs the JavaScript expression engine (Project Settings › Expressions › JavaScript, the default since AE 16.0).
