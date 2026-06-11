const fs = require('fs');
const { initWasm, Resvg } = require('@resvg/resvg-wasm');
(async () => {
  await initWasm();
  const svg = fs.readFileSync('src/assets/elite-bank-logo.svg', 'utf8');
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 800 } });
  const png = resvg.render();
  fs.writeFileSync('src/assets/elite-bank-logo-preview.png', png.asPng());
  console.log('wrote src/assets/elite-bank-logo-preview.png');
})();
