// Genera el HTML de producción con huellas para renovar la caché del hosting.
// No contiene conexiones ni credenciales de despliegue.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex').slice(0, 10);
const imports = {};
function modules(dir) {
  for (const item of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const file = `${dir}/${item.name}`;
    if (item.isDirectory()) modules(file);
    else if (file.endsWith('.js')) imports[`./${file}`] = `./${file}?v=${hash(file)}`;
  }
}
modules('js');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
html = html.replace('href="css/style.css"', `href="css/style.css?v=${hash('css/style.css')}"`);
html = html.replace('</head>', `<meta name="sw" content="sw.js?v=${hash('sw.js')}">\n<script type="importmap">${JSON.stringify({ imports })}</script>\n</head>`);
html = html.replace("'lib/three.min.js',", `'lib/three.min.js?v=${hash('lib/three.min.js')}',`);
const target = path.join(root, 'dist', 'production');
fs.mkdirSync(target, { recursive: true });
fs.writeFileSync(path.join(target, 'index.html'), html);
console.log('HTML de producción generado en dist/production/index.html');
