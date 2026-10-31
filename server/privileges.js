import { chownSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Lancé en root (conteneur Docker), rend le dossier de données à PUID:PGID puis abandonne les droits root.
 * Évite les « unable to open database file » quand le volume monté appartient à un autre utilisateur (TrueNAS…).
 */
export function prepareDataDir(dir) {
  try {
    mkdirSync(dir, { recursive: true });
  } catch {
    // openDb remontera une erreur explicite si le dossier est inutilisable.
  }
  if (typeof process.getuid !== 'function' || process.getuid() !== 0) return;

  const uid = Number(process.env.PUID ?? 1000);
  const gid = Number(process.env.PGID ?? 1000);
  if (uid === 0) return;

  try {
    chownSync(dir, uid, gid);
    for (const name of readdirSync(dir)) chownSync(join(dir, name), uid, gid);
  } catch (err) {
    console.warn(`Impossible de donner ${dir} à ${uid}:${gid} (${err.code}). Vérifie les permissions du volume.`);
  }
  process.setgroups([gid]);
  process.setgid(gid);
  process.setuid(uid);
  console.log(`Données dans ${dir}, exécution en ${uid}:${gid}`);
}
