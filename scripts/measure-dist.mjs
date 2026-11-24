import fs from 'node:fs'
import zlib from 'node:zlib'
import path from 'node:path'

const d = path.join(process.cwd(), 'dist')
const assets = path.join(d, 'assets')
const rows = []
let totalRaw = 0, totalGz = 0
for (const f of fs.readdirSync(assets)) {
  if (!/\.(js|css)$/.test(f)) continue
  const b = fs.readFileSync(path.join(assets, f))
  const gz = zlib.gzipSync(b, { level: 9 }).length
  rows.push({ f, raw: b.length, gz })
  totalRaw += b.length; totalGz += gz
}
rows.sort((a, b) => b.raw - a.raw)
console.log('FILE'.padEnd(44), 'RAW'.padStart(10), 'GZIP'.padStart(9))
for (const r of rows) console.log(r.f.padEnd(44), String(r.raw).padStart(10), String(r.gz).padStart(9))
console.log('-'.repeat(65))
console.log('TOTAL'.padEnd(44), String(totalRaw).padStart(10), String(totalGz).padStart(9))

// 入口首屏实下载：index.html 里的 script + modulepreload + stylesheet
const html = fs.readFileSync(path.join(d, 'index.html'), 'utf8')
const refs = [...html.matchAll(/(?:src|href)="([^"]*\.(?:js|css))"/g)].map(m => m[1])
let firstRaw = 0, firstGz = 0
console.log('\nFIRST PAINT (from index.html):')
for (const r of refs) {
  const p = path.join(d, r.replace(/^\//, ''))
  if (!fs.existsSync(p)) { console.log('  MISSING', r); continue }
  const b = fs.readFileSync(p)
  const gz = zlib.gzipSync(b, { level: 9 }).length
  firstRaw += b.length; firstGz += gz
  console.log('  ' + path.basename(r).padEnd(40), String(b.length).padStart(10), String(gz).padStart(9))
}
console.log('  ' + 'SUM'.padEnd(40), String(firstRaw).padStart(10), String(firstGz).padStart(9))
