// Usage: node check-images.js [baseUrl]
const BASE = process.argv[2] || 'http://localhost:4000';
const IMG = /\.(jpe?g|png|webp|gif|svg|avif)(\?.*)?$/i;

function collect(node, ctx, out) {
  if (typeof node === 'string') {
    if (IMG.test(node)) out.push({ product: ctx, url: node });
  } else if (Array.isArray(node)) {
    node.forEach(n => collect(n, ctx, out));
  } else if (node && typeof node === 'object') {
    Object.values(node).forEach(v => collect(v, ctx, out));
  }
}

(async () => {
  const res = await fetch(BASE + '/api/products');
  const data = await res.json();
  const list = Array.isArray(data)
    ? data
    : data.products || data.items || data.data || [data];

  const found = [];
  for (const p of list) {
    collect(p, p.name || p.title || p.id || p.slug || p._id, found);
  }

  // de-duplicate identical product+url pairs
  const seen = new Set();
  const items = found.filter(f => {
    const k = f.product + '|' + f.url;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const missing = [];
  let ok = 0;
  for (let i = 0; i < items.length; i += 10) {
    await Promise.all(
      items.slice(i, i + 10).map(async it => {
        try {
          const r = await fetch(new URL(it.url, BASE));
          if (r.status === 404) missing.push(it);
          else if (r.ok) ok++;
          else missing.push({ ...it, status: r.status });
        } catch (e) {
          missing.push({ ...it, status: 'ERR ' + e.message });
        }
      })
    );
  }

  console.log(`\nProducts checked: ${list.length}`);
  console.log(`Image URLs checked: ${items.length}`);
  console.log(`Working: ${ok}`);
  console.log(`Broken (404/error): ${missing.length}\n`);
  missing.forEach(m =>
    console.log(`- [${m.status || 404}] ${m.product}  ->  ${m.url}`)
  );
})();