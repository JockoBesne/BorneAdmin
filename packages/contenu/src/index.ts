/* Point d'entrée « données » du paquet partagé.
 * Volontairement sans React ni CSS : l'API l'importe aussi (§7.2).
 * Le rendu se trouve dans « @borne/contenu/rendu ». */

export * from './types.js'
export * from './modeles/index.js'
export * from './controles.js'
export * from './lecture.js'
export * from './texte.js'
export * from './manifeste.js'
