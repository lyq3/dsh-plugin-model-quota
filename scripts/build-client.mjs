import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join, posix } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(new URL('../package.json', import.meta.url)))
const buildDir = join(root, '.client-build')
const outputPath = join(root, 'lib', 'client.js')

async function collectSources(dir, rel = '') {
  const sources = new Map()
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name)
    const key = rel ? `${rel}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      for (const [child, source] of await collectSources(abs, key)) sources.set(child, source)
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      sources.set(key, (await readFile(abs, 'utf8')).replace(/\n?\/\/# sourceMappingURL=.*$/u, ''))
    }
  }
  return sources
}

const sources = await collectSources(buildDir)
const requirePattern = /require\("(\.[^"]+\.js)"\)/g
const resolveChild = (parent, relative) => posix.join(posix.dirname(parent), relative.slice(2))
const visited = new Set()
const order = []
function visit(file) {
  if (visited.has(file)) return
  visited.add(file)
  const source = sources.get(file)
  if (source === undefined) throw new Error(`client module not found: ${file}`)
  for (const match of source.matchAll(requirePattern)) visit(resolveChild(file, match[1]))
  order.push(file)
}
visit('index.js')

const modules = order.map((file) => {
  const source = sources.get(file).replace(requirePattern, (_match, rel) => `require("./${resolveChild(file, rel)}")`)
  return `__modules[${JSON.stringify(file)}] = function (require, module, exports) {\n${source}\n};`
}).join('\n')

const wrapped = [
  'window.__ModuleLoader__.load({ id: "dsh-plugin-model-quota", factory: (require) => {',
  'var __modules = {};',
  modules,
  'var __cache = {};',
  'function __localRequire(id) {',
  '  if (id.charCodeAt(0) !== 46) return require(id);',
  '  id = id.slice(2);',
  '  var cached = __cache[id];',
  '  if (cached) return cached.exports;',
  '  var module = { exports: {} };',
  '  __cache[id] = module;',
  '  __modules[id](__localRequire, module, module.exports);',
  '  return module.exports;',
  '}',
  'var module = { exports: {} };',
  '__modules["index.js"](__localRequire, module, module.exports);',
  'return module.exports; } });',
  '',
].join('\n')

await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, wrapped)
await rm(join(root, 'lib', 'client.js.map'), { force: true })
await rm(buildDir, { recursive: true, force: true })
console.log(`client bundle written: ${outputPath} (${order.length} modules inlined)`)
