/**
 * Croix de fermeture d'une fenêtre de réglages.
 *
 * Elle est **collée en haut** de la fenêtre : les panneaux de réglages
 * défilent, et le bouton « Terminé » du bas devenait alors introuvable sans
 * tout parcourir. La croix reste visible où qu'on en soit dans la page.
 *
 * Sa cible fait 44 px : on la touche au doigt, sans clavier ni souris.
 */
export function BoutonFermer({ surFermeture, libelle }: { surFermeture: () => void; libelle: string }) {
  return (
    <button
      type="button"
      className="voile__fermer"
      onClick={surFermeture}
      aria-label={libelle}
      title={libelle}
    >
      <span aria-hidden="true">×</span>
    </button>
  )
}
