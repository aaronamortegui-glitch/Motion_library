// Exporta library/library.json desde ss_presets.jsx (fuente única de verdad de los metadatos).
#include "ss_presets.jsx"
var SS_ROOT = (typeof SS_ROOT !== "undefined" && SS_ROOT) || File($.fileName).parent.parent.fsName.split("\\").join("/");
(function () {
    function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
    function esc(s) { return String(s).split('"').join('\\"'); }
    var out = [];
    function add(kind, call, names, src) {
        for (var i = 0; i < names.length; i++) {
            var p = src[names[i]], s = slug(names[i]);
            out.push('{"name":"' + esc(names[i]) + '","slug":"' + s + '","kind":"' + kind + '","channels":"' + esc(p.channels) +
                '","energy":"' + p.energy + '","use":"' + esc(p.use) + '","gif":"gifs/' + kind + "/" + s + '.gif","call":"' + esc(call.replace("%s", names[i])) + '"}');
        }
    }
    add("motion", 'SSP.apply(layer, "%s", "both")', SSP.names(), SSP.presets);
    add("fx", 'SSP.applyFx(layer, "%s")', SSP.effectNames(), SSP.effects);
    add("text", 'SSP.applyText(textLayer, "%s", "both")', SSP.textNames(), SSP.text);
    var f = new File(SS_ROOT + "/library/library.json");
    f.encoding = "UTF-8"; f.open("w");
    f.write('{"version":"0.1","tokens":"../tokens/superside_motion_tokens.json","presets":[' + out.join(",") + "]}");
    f.close();
    return out.length + " presets exportados";
})();
