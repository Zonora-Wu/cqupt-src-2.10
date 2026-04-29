const { spawnSync } = require('node:child_process')
const { join } = require('node:path')

const backendRoot = join(__dirname, '..')
const backendNodeModules = join(backendRoot, 'node_modules')
const prismaBin = process.platform === 'win32'
  ? join(backendNodeModules, '.bin', 'prisma.cmd')
  : join(backendNodeModules, '.bin', 'prisma')

const args = process.argv.slice(2)
const result = spawnSync(
  prismaBin,
  ['migrate', 'dev', '--schema', '../database/prisma/schema.prisma', '--skip-generate', ...args],
  {
    cwd: backendRoot,
    env: {
      ...process.env,
      NODE_PATH: backendNodeModules,
      PRISMA_GENERATE_SKIP_AUTOINSTALL: 'true',
    },
    shell: process.platform === 'win32',
    stdio: 'inherit',
  },
)

if (result.error) {
  console.error(result.error)
}

process.exit(result.status ?? 1)
