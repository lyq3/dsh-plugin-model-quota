import { readFile, stat } from 'node:fs/promises'

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
const requiredExports = ['.', './client', './cordis.patch.yml', './package.json']
for (const key of requiredExports) {
  if (!(key in pkg.exports)) throw new Error(`missing package export: ${key}`)
}
if (pkg.dsh?.bundle?.patch !== './cordis.patch.yml') throw new Error('invalid dsh.bundle.patch')
if (pkg.dsh?.client?.platform !== 'web') throw new Error('invalid dsh.client.platform')
const client = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')
if (!client.startsWith('window.__ModuleLoader__.load({ id: "dsh-plugin-model-quota"')) {
  throw new Error('client bundle is not a DSH lazy-CJS factory')
}
const externalRequires = [...client.matchAll(/require\("([^".][^"]*)"\)/g)].map((match) => match[1])
const allowedExternalRequires = new Set(['react', 'react/jsx-runtime', '@deepseek-ai/dsh-client-runtime/client'])
for (const id of externalRequires) {
  if (!allowedExternalRequires.has(id)) throw new Error(`unexpected client runtime require: ${id}`)
  if (id.includes('/lib/types/')) throw new Error(`type-only deep path leaked into client runtime: ${id}`)
}
for (const path of ['../lib/index.js', '../lib/types/index.d.ts', '../cordis.patch.yml', '../SECURITY.md']) {
  const info = await stat(new URL(path, import.meta.url))
  if (!info.isFile()) throw new Error(`required artifact is not a file: ${path}`)
}
console.log('package metadata and DSH bundle artifacts verified')
