// Lance les trois processus de développement dans un seul terminal.
// Volontairement sans dépendance (pas de « concurrently ») : 40 lignes suffisent.
import { spawn } from 'node:child_process'
import process from 'node:process'

const COULEURS = { api: '\x1b[36m', admin: '\x1b[35m', borne: '\x1b[33m' }
const RAZ = '\x1b[0m'

const processus = [
  { nom: 'api', commande: 'npm', args: ['run', 'dev', '-w', '@borne/api'] },
  { nom: 'admin', commande: 'npm', args: ['run', 'dev', '-w', '@borne/admin'] },
  { nom: 'borne', commande: 'npm', args: ['run', 'dev', '-w', '@borne/borne'] },
]

const enfants = []

function prefixer(nom, flux) {
  let reste = ''
  return (morceau) => {
    const lignes = (reste + morceau).split('\n')
    reste = lignes.pop() ?? ''
    for (const ligne of lignes) {
      flux.write(`${COULEURS[nom]}[${nom}]${RAZ} ${ligne}\n`)
    }
  }
}

for (const { nom, commande, args } of processus) {
  const enfant = spawn(commande, args, {
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, FORCE_COLOR: '1' },
  })
  enfant.stdout.on('data', prefixer(nom, process.stdout))
  enfant.stderr.on('data', prefixer(nom, process.stderr))
  enfant.on('exit', (code) => {
    process.stdout.write(`${COULEURS[nom]}[${nom}]${RAZ} arrêté (code ${code})\n`)
  })
  enfants.push(enfant)
}

function toutArreter() {
  for (const enfant of enfants) enfant.kill()
  process.exit(0)
}

process.on('SIGINT', toutArreter)
process.on('SIGTERM', toutArreter)

console.log(`
  Administration : http://localhost:5174
  Borne          : http://localhost:5173
  API            : http://localhost:3000

  Comptes de démonstration : s.martin / motdepassedemo   (éditeur)
                             h.dubois / motdepassedemo   (administrateur)
  Code PIN de la borne     : 1975
`)
