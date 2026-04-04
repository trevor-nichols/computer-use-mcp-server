import { copyFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const packageRoot = path.dirname(fileURLToPath(new URL('../package.json', import.meta.url)))
const profile = process.argv[2] === 'debug' ? 'debug' : 'release'
const cargoArgs = ['build']
if (profile === 'release') {
  cargoArgs.push('--release')
}

const cargo = spawnSync('cargo', cargoArgs, {
  cwd: packageRoot,
  stdio: 'inherit',
  env: process.env,
})

if (cargo.status !== 0) {
  process.exit(cargo.status ?? 1)
}

const dylibName = process.platform === 'darwin'
  ? 'libcomputer_use_native_input.dylib'
  : process.platform === 'win32'
    ? 'computer_use_native_input.dll'
    : 'libcomputer_use_native_input.so'

const artifact = path.join(packageRoot, 'target', profile, dylibName)
const destination = path.join(packageRoot, 'native-input.node')

if (!existsSync(artifact)) {
  console.error(`Expected native artifact at ${artifact}, but it was not produced.`)
  process.exit(1)
}

copyFileSync(artifact, destination)
console.log(`Copied ${artifact} -> ${destination}`)
