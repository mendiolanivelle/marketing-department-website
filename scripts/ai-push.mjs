import { spawnSync } from 'node:child_process'

function run(command, args, { capture = false } = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: capture ? 'pipe' : 'inherit',
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(' ')}`)
  }
  return capture ? (result.stdout || '').trim() : result.status
}

function runNpm(args) {
  const npmExecPath = process.env.npm_execpath
  if (!npmExecPath) {
    throw new Error('Run this helper through npm: npm run ai:push -- "short commit message"')
  }
  return run(process.execPath, [npmExecPath, ...args])
}

function changedPaths() {
  return new Set([
    ...run('git', ['diff', '--name-only', '--diff-filter=ACMR'], { capture: true }).split('\n'),
    ...run('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], { capture: true }).split('\n'),
    ...run('git', ['ls-files', '--others', '--exclude-standard'], { capture: true }).split('\n'),
  ].filter(Boolean))
}

function isSecretConfigPath(path) {
  const name = path.split('/').pop()?.toLowerCase()
  if (!name || name === '.env.example') return false
  return name === '.env'
    || name.startsWith('.env.')
    || ['.npmrc', '.netrc', '.pypirc', 'credentials.json'].includes(name)
}

const cliArgs = process.argv.slice(2)
const skipChecks = cliArgs.includes('--skip-checks') || cliArgs.includes('-SkipChecks')
const message = cliArgs
  .filter(arg => arg !== '--skip-checks' && arg !== '-SkipChecks')
  .join(' ')
  .trim()

if (!message) {
  throw new Error('Usage: npm run ai:push -- "short commit message" [--skip-checks]')
}

const repoRoot = run('git', ['rev-parse', '--show-toplevel'], { capture: true })
if (!repoRoot) throw new Error('This script must be run inside a Git repository.')
process.chdir(repoRoot)

const branch = run('git', ['branch', '--show-current'], { capture: true })
if (!branch) throw new Error('Could not determine the current branch.')

const upstreamResult = spawnSync(
  'git',
  ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'],
  { encoding: 'utf8', stdio: 'pipe' },
)
const hasUpstream = upstreamResult.status === 0 && upstreamResult.stdout.trim()
const status = run('git', ['status', '--porcelain'], { capture: true })

if (!status) {
  if (hasUpstream) {
    const upstream = upstreamResult.stdout.trim()
    const ahead = Number(run('git', ['rev-list', '--count', `${upstream}..HEAD`], { capture: true }))
    if (ahead > 0) {
      run('git', ['push'])
      console.log(`Pushed ${branch} to GitHub.`)
      process.exit(0)
    }
  } else {
    run('git', ['push', '-u', 'origin', branch])
    console.log(`Pushed ${branch} to GitHub.`)
    process.exit(0)
  }
  console.log('No local changes or unpushed commits.')
  process.exit(0)
}

const secretConfigPaths = [...changedPaths()].filter(isSecretConfigPath)
if (secretConfigPaths.length > 0) {
  throw new Error(`Refusing to stage secret configuration files: ${secretConfigPaths.join(', ')}`)
}

if (!skipChecks) {
  runNpm(['run', 'lint'])
  runNpm(['test'])
  runNpm(['run', 'build'])
}

run('git', ['add', '-A'])
const staged = run('git', ['diff', '--cached', '--name-only'], { capture: true })
if (!staged) {
  console.log('No staged changes to commit.')
  process.exit(0)
}

run('git', ['commit', '-m', message])
run('git', hasUpstream ? ['push'] : ['push', '-u', 'origin', branch])
console.log(`Pushed ${branch} to GitHub.`)
