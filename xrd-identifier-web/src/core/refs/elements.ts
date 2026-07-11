/** 元素記号による参照相フィルタ */

import type { RefPhase } from '../types';

const ELEMENT_SYMBOLS = new Set(
  'H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr'.split(
    ' ',
  ),
);

export function referenceElements(ref: RefPhase): Set<string> {
  const text = [ref.displayName, ref.name, ref.rawName].join(' ');
  return new Set((text.match(/[A-Z][a-z]?/g) || []).filter((s) => ELEMENT_SYMBOLS.has(s)));
}

export function referenceMatchesElementFilter(ref: RefPhase, filterText: string): boolean {
  const raw = String(filterText || '').trim();
  if (!raw) return true;
  const wanted = raw.match(/[A-Z][a-z]?/g) || [];
  if (!wanted.length) return true;
  const have = referenceElements(ref);
  return wanted.every((e) => have.has(e));
}
