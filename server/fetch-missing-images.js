const fs = require('fs');
const path = require('path');

const LOCAL = process.argv[2];
const LIVE = process.argv[3];
const ASSETS_DIR = process.argv[4];

if (!LOCAL || !LIVE || !ASSETS_DIR) {
  console.log('Usage: node fetch-missing-images.js <localUrl> <liveUrl> <assetsDir>');
  process.exit(1);
}

(async () => {
  const data = await (await fetch(LOCAL + '/api/products')).json();
  const list = Array.isArray(data) ? data : data.products || data.items || [];
  let got = 0, failed = 0;

  for (const p of list) {
    const urls = JSON.stringify(p).match(/assets\/uploads\/[^"\\]+\.(jpe?g|png|webp)/gi) || [];
    for (const url of urls) {
      const r = await fetch(`${LOCAL}/${url}`);
      if (r.status !== 404) continue;
      const live = await fetch(`${LIVE}/${url}`);
      if (!live.ok) { console.log('NOT ON LIVE:', url); failed++; continue; }
      const dest = path.join(ASSETS_DIR, url.replace(/^assets[\\/]/, ''));
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, Buffer.from(await live.arrayBuffer()));
      console.log('Downloaded:', url);
      got++;
    }
  }
  console.log(`\nDone. Downloaded ${got}, failed ${failed}`);
})();