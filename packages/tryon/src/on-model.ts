/**
 * Picks the best on-model photograph for an outfit. Photos are pre-produced
 * (brand shoots or AI-generated fictional models) and tagged with what the
 * model wears. When no exact photo exists, the closest one is returned with
 * an honest note saying what differs — never a silent substitution.
 */
export interface WornItem { slug: string; colour: string; title?: string }
export interface OnModelPhoto { id: string; src: string; alt: string; base?: WornItem; outer?: WornItem }
export interface Outfit { base?: WornItem; outer?: WornItem }

function score(p: OnModelPhoto, o: Outfit): number {
  let s = 0;
  for (const slot of ["base", "outer"] as const) {
    const want = o[slot], have = p[slot];
    if (want && have) s += (want.slug === have.slug ? 4 : 0) + (want.slug === have.slug && want.colour === have.colour ? 2 : 0);
    else if (want && !have) s -= 3;
    else if (!want && have) s -= 5;
  }
  return s;
}

export function pickOnModelPhoto(photos: readonly OnModelPhoto[], outfit: Outfit): { photo: OnModelPhoto; exact: boolean; note: string | null } | null {
  if (photos.length === 0) return null;
  const best = [...photos].sort((a, b) => score(b, outfit) - score(a, outfit) || a.id.localeCompare(b.id))[0]!;
  const diffs: string[] = [];
  for (const slot of ["base", "outer"] as const) {
    const want = outfit[slot], have = best[slot];
    const name = (w: WornItem) => w.title ?? w.slug;
    if (want && have && want.slug === have.slug && want.colour !== have.colour) diffs.push(`${name(want)} shown in ${have.colour} (no ${want.colour} photo yet)`);
    else if (want && have && want.slug !== have.slug) diffs.push(`shown with ${name(have)} in ${have.colour} instead of ${name(want)}`);
    else if (want && !have) diffs.push(`${name(want)} not shown — no photo of this combination yet`);
    else if (!want && have) diffs.push(`also wearing ${name(have)} in ${have.colour}`);
  }
  return { photo: best, exact: diffs.length === 0, note: diffs.length ? `Photo: ${diffs.join("; ")}.` : null };
}
