import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const srcRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src')

export async function resolve(specifier, context, nextResolve) {
  if (!specifier.startsWith('@/')) return nextResolve(specifier, context)
  const target = path.join(srcRoot, specifier.slice(2))
  for (const candidate of [target, target + '.js', path.join(target, 'index.js')]) {
    try {
      if (fs.statSync(candidate).isFile()) return nextResolve(pathToFileURL(candidate).href, context)
    } catch {}
  }
  return nextResolve(specifier, context)
}
