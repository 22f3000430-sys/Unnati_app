const SYNONYM_GROUPS: string[][] = [
  ['HIND', 'HIN', 'HINDI', 'HND'],
  ['HGEN', 'GENH', 'GHIND', 'GHIN'],
  ['ENG', 'ENGL', 'ENGLISH'],
  ['MATH', 'MAT', 'MATHS', 'MATHEMATICS'],
  ['SC', 'SCI', 'SCIENCE'],
  ['SLSC', 'SSC', 'SST', 'SOCSC', 'SOCIAL'],
  ['DRG', 'DRGD', 'DRA', 'DRAW', 'ART'],
  ['COM', 'COMM', 'COMMERCE'],
  ['PHY', 'PHYS', 'PHYSICS'],
  ['CHEM', 'CHM', 'CHEMISTRY'],
  ['BIO', 'BIOL', 'BIOLOGY'],
  ['HIST', 'HIS', 'HISTORY'],
  ['CIV', 'POL', 'CIVICS', 'POLSC'],
  ['GEOG', 'GEO', 'GEOGRAPHY'],
  ['ECON', 'ECO', 'ECONOMICS'],
  ['SOC', 'SOCIO', 'SOCIOLOGY'],
  ['COMP', 'CS', 'IT', 'CA'],
  ['ACC', 'ACCT', 'ACCOUNTS', 'ACCOUNTANCY'],
  ['BST', 'BUS', 'BUSINESS'],
  ['SANS', 'SKT', 'SANSKRIT'],
  ['AGRI', 'AG', 'AGRICULTURE'],
];

const CANONICAL_MAP = new Map<string, string>();
for (const group of SYNONYM_GROUPS) {
  const canonical = group[0];
  for (const alias of group) {
    CANONICAL_MAP.set(alias, canonical);
  }
}

export function normalizeSubjectToken(raw: string): string {
  const clean = raw.replace(/[^A-Z0-9]/gi, '').trim().toUpperCase();
  if (!clean) return '';
  return CANONICAL_MAP.get(clean) ?? clean;
}

export function parseSubjectTokens(subjectsStr: string): string[] {
  return subjectsStr
    .split(/[\s,;/|]+/)
    .map((t) => normalizeSubjectToken(t))
    .filter(Boolean);
}

export function studentTakesSubject(studentSubjects: string, examSubjectCode: string): boolean {
  const target = normalizeSubjectToken(examSubjectCode);
  if (!target) return false;
  const studentTokens = parseSubjectTokens(studentSubjects);
  if (studentTokens.includes(target)) return true;

  // Board Hindi equivalence: HIND paper vs HGEN in some streams when exact match absent
  if ((target === 'HIND' || target === 'HGEN') && (studentTokens.includes('HIND') || studentTokens.includes('HGEN'))) {
    return true;
  }
  return false;
}
