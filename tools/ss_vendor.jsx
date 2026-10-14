// SS Vendor — loads the open-source expression libraries in vendor/ (eKeys, aefunctions; MIT, see vendor/README.md).
// Usage: #include "ss_vendor.jsx"
//        var line = SSV.expressionLib("eKeys");   // imports vendor/ekeys/eKeys.jsx once, returns the expression line
//        prop.expression = line + "\neKeys.animate([...], time);";
var SSV = (function () {
    var ROOT = File($.fileName).parent.parent;
    var LIBS = { eKeys: "ekeys/eKeys.jsx", aefunctions: "aefunctions/aefunctions.jsx" };
    function expressionLib(name) {
        if (!LIBS[name]) throw new Error("Unknown expression library: " + name + " (eKeys, aefunctions)");
        var file = File(ROOT.fsName + "/vendor/" + LIBS[name]), proj = app.project, item = null;
        for (var i = 1; i <= proj.numItems; i++) { var it = proj.item(i); if (it instanceof FootageItem && it.file && it.file.fsName === file.fsName) item = it; }
        if (!item) item = proj.importFile(new ImportOptions(file));   // .jsx files import as data footage
        var call = name === "aefunctions" ? ".sourceData.getFunctions()" : ".sourceData";
        return "const " + name + " = footage(" + '"' + item.name + '"' + ")" + call + ";";
    }
    return { expressionLib: expressionLib, root: ROOT };
})();
