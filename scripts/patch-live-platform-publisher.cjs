const fs = require("fs");
const path = require("path");

const root = process.argv[2];
if (!root) throw new Error("Pass the extracted app directory.");
const assets = path.join(root, "dist", "assets");
const renderer = fs.readdirSync(assets).find((name) => /^index-.*\.js$/.test(name));
if (!renderer) throw new Error("Renderer bundle not found.");
const file = path.join(assets, renderer);
let source = fs.readFileSync(file, "utf8");

function replaceOnce(before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}.`);
  source = source.replace(before, after);
}

replaceOnce(
  '[Wn,Xi]=m.useState("optional")',
  '[Wn,Xi]=m.useState("optional"),[io,setIo]=m.useState("desktop")',
  "release target state",
);
replaceOnce(
  'Gs={releaseType:Tt,modules:Qn,notes:Cn,installationPolicy:Wn}',
  'Gs={releaseType:Tt,modules:Qn,notes:Cn,installationPolicy:Wn,target:io}',
  "release target manifest",
);

const marker = 'n.jsx("div",{className:"release-type-picker",role:"radiogroup","aria-label":"Release type"';
const targetUi = 'n.jsxs("div",{className:"installation-policy",children:[n.jsxs("div",{children:[n.jsx("strong",{children:"Release target"}),n.jsx("small",{children:"Choose which Sentinel Base installations receive this release."})]}),n.jsxs("div",{role:"radiogroup","aria-label":"Release target",children:[n.jsxs("button",{type:"button",className:io==="desktop"?"selected":"",onClick:()=>setIo("desktop"),children:[n.jsx("strong",{children:"Desktop"}),n.jsx("small",{children:"Windows Base only"})]}),n.jsxs("button",{type:"button",className:io==="ios"?"selected":"",onClick:()=>setIo("ios"),children:[n.jsx("strong",{children:"iPhone"}),n.jsx("small",{children:"iOS safe content only"})]}),n.jsxs("button",{type:"button",className:io==="both"?"selected":"",onClick:()=>setIo("both"),children:[n.jsx("strong",{children:"Both"}),n.jsx("small",{children:"Desktop and iPhone"})]})]})]}),';
replaceOnce(marker, targetUi + marker, "release target controls");

const publisherMarker = 'n.jsxs("div",{className:"publisher-ready",children:';
const inventoryUi = 'n.jsxs("div",{className:"release-discovery-notice",children:[n.jsx(Za,{}),n.jsxs("div",{children:[n.jsx("strong",{children:"Registered Base installations"}),n.jsx("small",{children:(zt?.installations??[]).length?`${(zt?.installations??[]).filter(T=>T.platform==="windows").length} Desktop · ${(zt?.installations??[]).filter(T=>T.platform==="ios").length} iPhone`:"Clients appear here after their next cloud check."})]})]}),';
// Use an existing monitor icon symbol only when present; otherwise omit the icon safely.
const safeInventoryUi = inventoryUi.replace('n.jsx(Za,{})', 'n.jsx("span",{children:"◉"})');
replaceOnce(publisherMarker, safeInventoryUi + publisherMarker, "installation inventory");

fs.writeFileSync(file, source);
console.log(`Patched ${file}`);
