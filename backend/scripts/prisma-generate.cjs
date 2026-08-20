const { spawnSync } = require('node:child_process')
const { join } = require('node:path')

const backendNodeModules = join(__dirname, '..', 'node_modules')
const prismaBin = process.platform === 'win32'
  ? join(backendNodeModules, '.bin', 'prisma.cmd')
  : join(backendNodeModules, '.bin', 'prisma')

const result = spawnSync(
  prismaBin,
  ['generate', '--schema', '../database/prisma/schema.prisma'],
  {
    cwd: join(__dirname, '..'),
    env: {
      ...process.env,
      NODE_PATH: backendNodeModules,
    },
    shell: process.platform === 'win32',
    stdio: 'inherit',
  },
)

if (result.error) {
  console.error(result.error)
}

process.exit(result.status ?? 1)
