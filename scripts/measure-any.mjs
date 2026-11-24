import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const d = process.argv[2]
const files = fs.readdirSync(path.join(d, 'assets'))
let tr = 0, tg = 0
const rows = []
for (const f of files) {
  if (!/\.(js|css)$/.test(f)) continue
  const b = fs.readFileSync(path.join(d, 'assets', f))
  const g = zlib.gzipSync(b, { level: 9 }).length
  tr += b.length; tg += g; rows.push([f, b.length, g])
}
rows.sort((a, b) => b[1] - a[1])
for (const r of rows.slice(0, 6)) console.log(r[0].padEnd(45), String(r[1]).padStart(9), String(r[2]).padStart(8))
console.log('TOTAL', tr, tg)
const html = fs.readFileSync(path.join(d, 'index.html'), 'utf8')
const refs = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(m => m[1])
let fr = 0, fg = 0
for (const r of refs) {
  const f = path.basename(r)
  const b = fs.readFileSync(path.join(d, 'assets', f))
  const g = zlib.gzipSync(b, { level: 9 }).length
  fr += b.length; fg += g
  console.log('  ', f.padEnd(40), String(b.length).padStart(9), String(g).padStart(8))
}
console.log('FIRST PAINT', fr, fg)
