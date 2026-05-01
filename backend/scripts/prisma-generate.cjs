const { spawnSync } = require('node:child_process')
const { existsSync, readFileSync, rmSync } = require('node:fs')
const { join, resolve } = require('node:path')

const backendNodeModules = join(__dirname, '..', 'node_modules')
const repoRoot = resolve(__dirname, '..', '..')
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

cleanupPrismaAutoInstall()

process.exit(result.status ?? 1)

function cleanupPrismaAutoInstall() {
  const rootPackageJson = join(repoRoot, 'package.json')
  const rootPackageLock = join(repoRoot, 'package-lock.json')
  const rootNodeModules = join(repoRoot, 'node_modules')

  if (!existsSync(rootPackageJson)) {
    return
  }

  let packageJson
  try {
    packageJson = JSON.parse(readFileSync(rootPackageJson, 'utf8'))
  } catch {
    return
  }

  // 如果是真实的 monorepo 根目录（有 workspaces 或 name 字段），不自动删除
  if (packageJson.workspaces || (packageJson.name && packageJson.private)) {
    return
  }

  const dependencies = Object.keys(packageJson.dependencies ?? {})
  const devDependencies = Object.keys(packageJson.devDependencies ?? {})
  const allDependencies = [...dependencies, ...devDependencies].sort()
  const isPrismaOnlyPackage =
    allDependencies.length > 0 &&
    allDependencies.every((dependency) => dependency === '@prisma/client' || dependency === 'prisma')

  if (!isPrismaOnlyPackage) {
    return
  }

  rmSync(rootPackageJson, { force: true })
  rmSync(rootPackageLock, { force: true })
  rmSync(rootNodeModules, { force: true, recursive: true })
}
