/* Formatage destiné à l'affichage : toujours en français, jamais technique. */

export function dateRelative(iso: string): string {
  const date = new Date(iso)
  const secondes = Math.round((Date.now() - date.getTime()) / 1000)

  if (secondes < 60) return "à l'instant"
  if (secondes < 3600) {
    const minutes = Math.floor(secondes / 60)
    return `il y a ${minutes} min`
  }
  if (secondes < 86_400) {
    const heures = Math.floor(secondes / 3600)
    return `il y a ${heures} h`
  }
  if (secondes < 172_800) return 'hier'
  if (secondes < 604_800) return `il y a ${Math.floor(secondes / 86_400)} jours`

  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function heure(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export function poids(octets: number): string {
  if (octets < 1024) return `${octets} o`
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} ko`
  return `${(octets / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`
}

export function duree(secondes: number | null): string | null {
  if (secondes === null) return null
  const minutes = Math.floor(secondes / 60)
  const reste = Math.round(secondes % 60)
  return `${minutes}:${String(reste).padStart(2, '0')}`
}

export function utilisations(nombre: number): string {
  if (nombre === 0) return 'Aucune page'
  if (nombre === 1) return '1 page'
  return `${nombre} pages`
}
