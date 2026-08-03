-- Schéma initial (§9.3 de la conception).
-- Toutes les dates sont en ISO-8601 UTC, tous les identifiants en ULID.

CREATE TABLE utilisateur (
  id                    TEXT PRIMARY KEY,
  identifiant           TEXT NOT NULL UNIQUE,
  nom_affiche           TEXT NOT NULL,
  mot_de_passe_hash     TEXT NOT NULL,
  role                  TEXT NOT NULL CHECK (role IN ('administrateur','editeur')),
  actif                 INTEGER NOT NULL DEFAULT 1,
  cree_le               TEXT NOT NULL,
  derniere_connexion_le TEXT,
  echecs_connexion      INTEGER NOT NULL DEFAULT 0,
  bloque_jusqu_a        TEXT
);

CREATE TABLE session (
  id             TEXT PRIMARY KEY,
  utilisateur_id TEXT NOT NULL REFERENCES utilisateur(id) ON DELETE CASCADE,
  jeton_hash     TEXT NOT NULL UNIQUE,
  jeton_csrf     TEXT NOT NULL,
  cree_le        TEXT NOT NULL,
  expire_le      TEXT NOT NULL,
  adresse_ip     TEXT
);
CREATE INDEX idx_session_utilisateur ON session(utilisateur_id);
CREATE INDEX idx_session_expiration  ON session(expire_le);

CREATE TABLE page (
  id                TEXT PRIMARY KEY,
  modele            TEXT NOT NULL CHECK (modele IN ('t1','t2','t3')),
  titre             TEXT NOT NULL,
  etat              TEXT NOT NULL CHECK (etat IN ('brouillon','en_ligne','retiree','corbeille')),
  ordre             REAL NOT NULL,
  contenu_brouillon TEXT NOT NULL,
  contenu_publie    TEXT,
  cree_le           TEXT NOT NULL,
  cree_par          TEXT NOT NULL REFERENCES utilisateur(id),
  modifiee_le       TEXT NOT NULL,
  modifiee_par      TEXT NOT NULL REFERENCES utilisateur(id),
  publiee_le        TEXT,
  supprimee_le      TEXT
);
CREATE INDEX idx_page_etat  ON page(etat);
CREATE INDEX idx_page_ordre ON page(ordre);

CREATE TABLE media (
  id              TEXT PRIMARY KEY,
  empreinte       TEXT NOT NULL UNIQUE,
  type            TEXT NOT NULL CHECK (type IN ('image','video')),
  mime            TEXT NOT NULL,
  extension       TEXT NOT NULL,
  nom_origine     TEXT NOT NULL,
  nom_affiche     TEXT NOT NULL,
  legende         TEXT NOT NULL DEFAULT '',
  poids_octets    INTEGER NOT NULL,
  poids_optimise  INTEGER NOT NULL DEFAULT 0,
  largeur         INTEGER,
  hauteur         INTEGER,
  duree_secondes  REAL,
  a_poster        INTEGER NOT NULL DEFAULT 0,
  point_focal_x   REAL NOT NULL DEFAULT 0.5,
  point_focal_y   REAL NOT NULL DEFAULT 0.5,
  cree_le         TEXT NOT NULL,
  cree_par        TEXT NOT NULL REFERENCES utilisateur(id)
);
CREATE INDEX idx_media_type ON media(type);

-- Index d'usage, reconstruit à chaque écriture d'une page dans la même
-- transaction. Répond à « où ce média est-il utilisé ? » et sécurise la
-- suppression (§9.4).
CREATE TABLE page_media (
  page_id  TEXT NOT NULL REFERENCES page(id) ON DELETE CASCADE,
  media_id TEXT NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  PRIMARY KEY (page_id, media_id)
);
CREATE INDEX idx_page_media_media ON page_media(media_id);

CREATE TABLE publication (
  version   INTEGER PRIMARY KEY AUTOINCREMENT,
  manifeste TEXT NOT NULL,
  empreinte TEXT NOT NULL,
  cree_le   TEXT NOT NULL,
  cree_par  TEXT NOT NULL REFERENCES utilisateur(id),
  motif     TEXT NOT NULL DEFAULT ''
);

CREATE TABLE parametre (
  cle        TEXT PRIMARY KEY,
  valeur     TEXT NOT NULL,
  modifie_le TEXT NOT NULL
);

CREATE TABLE journal (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  horodatage     TEXT NOT NULL,
  utilisateur_id TEXT REFERENCES utilisateur(id),
  action         TEXT NOT NULL,
  resume         TEXT NOT NULL,
  cible_id       TEXT,
  adresse_ip     TEXT
);
CREATE INDEX idx_journal_horodatage ON journal(horodatage DESC);
