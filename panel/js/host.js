// Talks to After Effects (panel/host/host.jsx) through CEP's evalScript. Outside After Effects (a browser, for
// design work) the calls are answered by a small stand-in so the UI can be previewed with a local web server:
//   python -m http.server 8765   (from the repo root)  →  http://localhost:8765/panel/index.html
const IN_AE = !!(window.__adobe_cep__);

function evalHost(src) {
  return new Promise((resolve) => {
    if (IN_AE) window.__adobe_cep__.evalScript(src, (r) => resolve(r));
    else resolve(browserStandIn(src));
  });
}
// call("mdna_apply", {kind, name}) → evaluates mdna_apply("{...}") in After Effects; objects travel as JSON strings
function call(fn, ...args) {
  const a = args.map((x) => JSON.stringify(typeof x === "string" ? x : JSON.stringify(x)));
  return evalHost(`${fn}(${a.join(",")})`);
}
function parse(r) { try { return JSON.parse(r); } catch (e) { return { error: String(r) }; } }

// Choosing a folder. ExtendScript's Folder.selectDialog opens Windows' old tree ("Browse For Folder"); on Windows the
// panel opens the modern Explorer picker instead (IFileOpenDialog with FOS_PICKFOLDERS, the window AE's own Import
// uses), through PowerShell, owned by the After Effects window so it opens on top. It starts in `start` when given.
// Elsewhere, or if PowerShell fails, the old dialog. Resolves to a path with forward slashes, or "" when cancelled.
const PICK_FOLDER_PS = `Add-Type -TypeDefinition @"
using System; using System.Runtime.InteropServices;
public static class MdnaPick {
  [ComImport, Guid("DC1C5A9C-E88A-4dde-A5A1-60F82A20AEF7")] class FileOpenDialogRCW {}
  [ComImport, Guid("42f85136-db7e-439c-85f1-e4075d135fc8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IFileDialog {
    [PreserveSig] int Show(IntPtr parent);
    void SetFileTypes(uint c, IntPtr f); void SetFileTypeIndex(uint i); void GetFileTypeIndex(out uint i);
    void Advise(IntPtr p, out uint c); void Unadvise(uint c); void SetOptions(uint o); void GetOptions(out uint o);
    void SetDefaultFolder(IShellItem i); void SetFolder(IShellItem i); void GetFolder(out IShellItem i); void GetCurrentSelection(out IShellItem i);
    void SetFileName([MarshalAs(UnmanagedType.LPWStr)] string n); void GetFileName([MarshalAs(UnmanagedType.LPWStr)] out string n);
    void SetTitle([MarshalAs(UnmanagedType.LPWStr)] string t); void SetOkButtonLabel([MarshalAs(UnmanagedType.LPWStr)] string t);
    void SetFileNameLabel([MarshalAs(UnmanagedType.LPWStr)] string t); void GetResult(out IShellItem i);
    void AddPlace(IShellItem i, int p); void SetDefaultExtension([MarshalAs(UnmanagedType.LPWStr)] string e);
    void Close(int hr); void SetClientGuid(ref Guid g); void ClearClientData(); void SetFilter(IntPtr f);
  }
  [ComImport, Guid("43826D1E-E718-42EE-BC55-A1E261C37BFE"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IShellItem {
    void BindToHandler(IntPtr pbc, ref Guid bhid, ref Guid riid, out IntPtr ppv); void GetParent(out IShellItem i);
    void GetDisplayName(uint sigdn, [MarshalAs(UnmanagedType.LPWStr)] out string name); void GetAttributes(uint m, out uint a); void Compare(IShellItem i, uint h, out int o);
  }
  [DllImport("shell32.dll", CharSet = CharSet.Unicode, PreserveSig = false)]
  static extern void SHCreateItemFromParsingName(string path, IntPtr pbc, ref Guid riid, out IShellItem item);
  public static string Pick(string title, string start, IntPtr owner) {
    var d = (IFileDialog)new FileOpenDialogRCW();
    d.SetOptions(0x20 | 0x40 | 0x800);   // pick folders, file-system paths only, the path must exist
    if (!string.IsNullOrEmpty(title)) d.SetTitle(title);
    if (!string.IsNullOrEmpty(start) && System.IO.Directory.Exists(start)) {
      var g = typeof(IShellItem).GUID; IShellItem s; SHCreateItemFromParsingName(start, IntPtr.Zero, ref g, out s); d.SetFolder(s);
    }
    if (d.Show(owner) != 0) return "";   // cancelled
    IShellItem r; d.GetResult(out r); string p; r.GetDisplayName(0x80058000, out p); return p;
  }
}
"@
$ae = Get-Process -Name AfterFX -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
$owner = if ($ae) { $ae.MainWindowHandle } else { [IntPtr]::Zero }
[Console]::OutputEncoding = [Text.Encoding]::UTF8
[Console]::Out.Write("PICKED:" + [MdnaPick]::Pick($env:MDNA_TITLE, $env:MDNA_START, $owner))`;
function pickFolder(title, start) {
  const req = IN_AE && (window.require || (window.cep_node && window.cep_node.require));
  const old = () => call("mdna_pick_folder", title);
  if (!req || req("process").platform !== "win32") return old();
  return new Promise((resolve) => {
    const enc = req("buffer").Buffer.from(PICK_FOLDER_PS, "utf16le").toString("base64");   // -EncodedCommand: no quoting, no execution policy
    const env = Object.assign({}, req("process").env, { MDNA_TITLE: title || "Choose a folder", MDNA_START: (start || "").replace(/\//g, "\\") });
    req("child_process").execFile("powershell.exe", ["-NoProfile", "-STA", "-NonInteractive", "-EncodedCommand", enc], { env, windowsHide: true, maxBuffer: 1 << 20 },
      (err, out) => {
        const m = /PICKED:(.*)$/s.exec(String(out || ""));
        if (err || !m) return old().then(resolve);   // PowerShell failed: the old dialog still works
        resolve(m[1].trim().replace(/\\/g, "/"));
      });
  });
}

// the extension folder as a plain path (CEP returns a file URL)
function extensionPath() {
  if (!IN_AE) return "";
  let p = decodeURI(window.__adobe_cep__.getSystemPath("extension"));
  return p.replace(/^file:\/{2,3}/, navigator.platform.startsWith("Win") ? "" : "/");
}
function fileUrl(path) { return "file:///" + encodeURI(path.replace(/\\/g, "/").replace(/^\//, "")).replace(/#/g, "%23"); }

// reads a repo file (library JSON): XHR, because fetch() cannot read file:// URLs in CEP
function readJSON(url) {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    // the same cache-buster as the scripts (index.html): CEP kept serving an old library/create.json after a reload,
    // so the panel showed orders that were already rewritten in the repo
    x.open("GET", url + (url.includes("?") ? "&" : "?") + "v=" + (window.__v || Date.now()));
    x.onload = () => { try { resolve(JSON.parse(x.responseText)); } catch (e) { reject(e); } };
    x.onerror = () => reject(new Error("cannot read " + url));
    x.send();
  });
}

function browserStandIn(src) {
  const fn = src.slice(0, src.indexOf("("));
  if (fn === "mdna_boot") return JSON.stringify({ root: "(browser preview)", presets: 0, bridge: true });
  if (fn === "mdna_status") return JSON.stringify({ bridge: true, minutes: 3 });
  if (fn === "mdna_apply") return "OK (browser preview: nothing applied)";
  if (fn === "mdna_remove") return "OK (browser preview: nothing removed)";
  if (fn === "mdna_brands") {   // the repo's templates, so the Brands section can be designed in a browser
    if (!window.__demoBrands) {
      window.__demoBrands = [];
      try { const x = new XMLHttpRequest(); x.open("GET", "../library/brands/motion-dna/brand.json", false); x.send(); window.__demoBrands.push({ where: "template", dir: "", b: JSON.parse(x.responseText) }); } catch (e) {}
    }
    return JSON.stringify(window.__demoBrands);
  }
  if (fn === "mdna_comp_info") return JSON.stringify({ fps: 30, project: "C:/projects/demo.aep" });
  if (fn === "mdna_capture") return JSON.stringify({ frames: 18, bz: [0.18, 0.28, 0, 0.9], layer: "Title", prop: "Position", stagger: 3, fps: 30 });
  if (fn === "mdna_brand_save") { const a = JSON.parse(JSON.parse(src.slice(src.indexOf("(") + 1, -1))); const b = JSON.parse(a.text); const L = (window.__demoBrands = window.__demoBrands || []); const i = L.findIndex((x) => x.b.slug === b.slug); if (i >= 0) L[i].b = b; else L.push({ where: "local", b }); return "OK saved"; }
  if (fn === "mdna_read_curve") return "[0.25,0.1,0.25,1]";
  // dialogs and files, for recording the share / import flow in a browser
  if (fn === "mdna_pick_save") return "C:/Users/you/Desktop/" + JSON.parse(src.slice(src.indexOf("(") + 1, -1));
  if (fn === "mdna_pick_open") return "C:/Users/you/Downloads/brand.motiondna-brand.json";
  if (fn === "mdna_pick_folder") return "D:/Clients";
  if (fn === "mdna_read_file") return window.__demoImport ? JSON.stringify(window.__demoImport) : "ERR missing";
  if (fn === "mdna_b64_file") return "";
  if (fn === "mdna_write_file") return "OK saved";
  if (fn === "mdna_sel_info") return JSON.stringify(window.__demoSel || { layers: 1, own: 1, ours: 0 });
  return "OK";
}
