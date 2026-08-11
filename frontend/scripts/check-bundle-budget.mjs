import { gzipSync } from 'node:zlib'
import { readdir, readFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'

const assetsDirectory = resolve('dist/assets')
const budgets = {
  cssGzipBytes: 38 * 1024,
  entryGzipBytes: 90 * 1024,
  totalJavaScriptGzipBytes: 750 * 1024,
  threeGzipBytes: 270 * 1024,
}

const files = await readdir(assetsDirectory)
const measured = await Promise.all(files.filter((file) => /\.(?:css|js)$/.test(file)).map(async (file) => {
  const path = resolve(assetsDirectory, file)
  const content = await readFile(path)
  return { file, gzipBytes: gzipSync(content, { level: 9 }).length, rawBytes: (await stat(path)).size }
}))

const css = measured.filter((item) => item.file.endsWith('.css')).reduce(sumGzip, 0)
const javascript = measured.filter((item) => item.file.endsWith('.js')).reduce(sumGzip, 0)
const entry = measured.filter((item) => /^index-.*\.js$/.test(item.file)).reduce(sumGzip, 0)
const three = measured.filter((item) => item.file.startsWith('vendor-three-')).reduce(sumGzip, 0)
const checks = [
  ['CSS gzip', css, budgets.cssGzipBytes],
  ['entry JavaScript gzip', entry, budgets.entryGzipBytes],
  ['total JavaScript gzip', javascript, budgets.totalJavaScriptGzipBytes],
  ['Three.js chunk gzip', three, budgets.threeGzipBytes],
]

let failed = false
for (const [name, actual, limit] of checks) {
  const ok = actual <= limit
  failed ||= !ok
  process.stdout.write(`${ok ? 'PASS' : 'FAIL'} ${name}: ${format(actual)} / ${format(limit)}\n`)
}
if (failed) process.exitCode = 1

function sumGzip(total, item) { return total + item.gzipBytes }
function format(bytes) { return `${(bytes / 1024).toFixed(1)} KiB` }
