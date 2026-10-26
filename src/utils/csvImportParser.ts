import { Pair, Player } from '../types/tournament';

export interface ParseResult {
  pairs: Pair[];
  eventName?: string;
  category?: string;
  totalRows: number;
  validCount: number;
  warnings: string[];
}

/**
 * Normalizes string for fuzzy header comparison
 * (e.g. "Nom joueur 1" -> "nomjoueur1", "Poids paire" -> "poidspaire")
 */
function normalizeHeader(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Splits CSV line taking care of quotes
 */
function splitCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Detect delimiter: comma, semicolon, or tab
 */
function detectDelimiter(firstLine: string): string {
  const commas = (firstLine.match(/,/g) || []).length;
  const semicolons = (firstLine.match(/;/g) || []).length;
  const tabs = (firstLine.match(/\t/g) || []).length;

  if (semicolons > commas && semicolons > tabs) return ';';
  if (tabs > commas && tabs > semicolons) return '\t';
  return ',';
}

/**
 * Parses FFT / Ten'Up "Liste des participants padel" CSV text into Pair[]
 */
export function parseFftParticipantsCsv(
  csvText: string,
  tournamentId: string
): ParseResult {
  const lines = csvText
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return {
      pairs: [],
      totalRows: 0,
      validCount: 0,
      warnings: ['Le fichier est vide.'],
    };
  }

  const delimiter = detectDelimiter(lines[0]);
  return parseFftParticipantsRows(
    lines.map(line => splitCsvLine(line, delimiter)),
    tournamentId
  );
}

export function parseFftParticipantsRows(
  inputRows: readonly (readonly unknown[])[],
  tournamentId: string,
  status: Pair['status'] = 'confirmed'
): ParseResult {
  const warnings: string[] = [];
  const rows = inputRows
    .map(row => row.map(value => {
      if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value.toLocaleDateString('fr-FR');
      }
      return value == null ? '' : String(value).trim();
    }))
    .filter(row => row.some(value => value.length > 0));

  if (rows.length === 0) {
    return {
      pairs: [],
      totalRows: 0,
      validCount: 0,
      warnings: ['Le fichier est vide.'],
    };
  }

  const rawHeaders = rows[0];
  const normalizedHeaders = rawHeaders.map(normalizeHeader);

  // Map header indexes
  const getIndex = (targets: string[]): number => {
    for (const target of targets) {
      const idx = normalizedHeaders.findIndex((h) => h === target || h.includes(target));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const idxEventName = getIndex(['nomdelepreuve', 'epreuve']);
  const idxCategory = getIndex(['categoriedelepreuve', 'categorie']);
  const idxPosition = getIndex(['positiondelapaire', 'position', 'rang']);

  // Player 1
  const idxP1Nom = getIndex(['nomjoueur1', 'joueur1nom', 'nom1']);
  const idxP1Prenom = getIndex(['prenomjoueur1', 'joueur1prenom', 'prenom1']);
  const idxP1Dob = getIndex(['datedenaissancejoueur1', 'naissancejoueur1', 'naissance1']);
  const idxP1Licence = getIndex(['licencejoueur1', 'numlicence1', 'licence1']);
  const idxP1Club = getIndex(['clubjoueur1', 'club1']);
  const idxP1Classement = getIndex(['classementjoueur1', 'rangjoueur1', 'classement1']);
  const idxP1Mail = getIndex(['mailjoueur1', 'emailjoueur1', 'courriel1']);
  const idxP1Tel = getIndex(['telephonejoueur1', 'teljoueur1', 'tel1']);

  // Player 2
  const idxP2Nom = getIndex(['nomjoueur2', 'joueur2nom', 'nom2']);
  const idxP2Prenom = getIndex(['prenomjoueur2', 'joueur2prenom', 'prenom2']);
  const idxP2Dob = getIndex(['datedenaissancejoueur2', 'naissancejoueur2', 'naissance2']);
  const idxP2Licence = getIndex(['licencejoueur2', 'numlicence2', 'licence2']);
  const idxP2Club = getIndex(['clubjoueur2', 'club2']);
  const idxP2Classement = getIndex(['classementjoueur2', 'rangjoueur2', 'classement2']);
  const idxP2Mail = getIndex(['mailjoueur2', 'emailjoueur2', 'courriel2']);
  const idxP2Tel = getIndex(['telephonejoueur2', 'teljoueur2', 'tel2']);

  const idxPoids = getIndex(['poidspaire', 'poids', 'totalpoids']);

  // Required header validation
  if (idxP1Nom === -1 || idxP2Nom === -1) {
    warnings.push(
      "Colonnes essentielles manquantes (Nom joueur 1 / Nom joueur 2 non détectés). Vérifiez les en-têtes."
    );
    return {
      pairs: [],
      totalRows: rows.length - 1,
      validCount: 0,
      warnings,
    };
  }

  const pairs: Pair[] = [];
  const importId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  let detectedEventName: string | undefined;
  let detectedCategory: string | undefined;

  for (let i = 1; i < rows.length; i++) {
    const rawCols = rows[i];
    if (rawCols.length < 2) continue;

    const getValue = (idx: number, fallback: string = ''): string => {
      if (idx === -1 || idx >= rawCols.length) return fallback;
      return rawCols[idx].trim();
    };

    const getNumber = (idx: number, fallback: number = 0): number => {
      const val = getValue(idx);
      if (!val) return fallback;
      const parsed = Number(val.replace(/\s/g, '').replace(',', '.'));
      return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
    };

    if (!detectedEventName && idxEventName !== -1) {
      detectedEventName = getValue(idxEventName);
    }
    if (!detectedCategory && idxCategory !== -1) {
      detectedCategory = getValue(idxCategory);
    }

    const p1Nom = getValue(idxP1Nom, `JoueurA_${i}`);
    const p1Prenom = getValue(idxP1Prenom, '');
    const p1Rank = getNumber(idxP1Classement, 99999);
    const p1Licence = getValue(idxP1Licence, '');
    const p1Club = getValue(idxP1Club, 'Club non renseigné');
    const p1Mail = getValue(idxP1Mail, '');
    const p1Tel = getValue(idxP1Tel, '');
    const p1Dob = getValue(idxP1Dob, '');

    const p2Nom = getValue(idxP2Nom, `JoueurB_${i}`);
    const p2Prenom = getValue(idxP2Prenom, '');
    const p2Rank = getNumber(idxP2Classement, 99999);
    const p2Licence = getValue(idxP2Licence, '');
    const p2Club = getValue(idxP2Club, p1Club || 'Club non renseigné');
    const p2Mail = getValue(idxP2Mail, '');
    const p2Tel = getValue(idxP2Tel, '');
    const p2Dob = getValue(idxP2Dob, '');
    if (!p1Nom && !p2Nom) continue;

    const pos = getNumber(idxPosition, i);

    // Compute or read weight
    let weight = getNumber(idxPoids, 0);
    if (weight === 0 || weight === p1Rank) {
      weight = p1Rank + p2Rank;
    }

    const player1: Player = {
      id: `pl_imp_${importId}_${i}_1`,
      firstName: p1Prenom,
      lastName: p1Nom,
      licenseNumber: p1Licence,
      ranking: p1Rank,
      email: p1Mail,
      phone: p1Tel,
      club: p1Club,
      birthDate: p1Dob || undefined,
      isPresent: false,
      paymentStatus: 'pending',
      paymentMethod: 'cash',
      paidAmount: 0,
    };

    const player2: Player = {
      id: `pl_imp_${importId}_${i}_2`,
      firstName: p2Prenom,
      lastName: p2Nom,
      licenseNumber: p2Licence,
      ranking: p2Rank,
      email: p2Mail,
      phone: p2Tel,
      club: p2Club,
      birthDate: p2Dob || undefined,
      isPresent: false,
      paymentStatus: 'pending',
      paymentMethod: 'cash',
      paidAmount: 0,
    };

    const pair: Pair = {
      id: `pair_fft_${importId}_${i}`,
      tournamentId,
      player1,
      player2,
      totalWeight: weight,
      entryPosition: pos,
      isDirectTableau: false,
      status,
      createdAt: new Date().toISOString().split('T')[0],
    };

    pairs.push(pair);
  }

  return {
    pairs,
    eventName: detectedEventName,
    category: detectedCategory,
    totalRows: rows.length - 1,
    validCount: pairs.length,
    warnings,
  };
}

/**
 * Built-in sample file content provided by user (9 pairs - ASPTT Fourragère)
 */
export const SAMPLE_FFT_FILE_CONTENT = `Nom de l'épreuve,Catégorie de l'épreuve,Position de la paire,Nom joueur 1,Prénom joueur 1,Date de naissance joueur 1,Licence joueur 1,Club joueur 1,Classement joueur 1,Mail joueur 1,Téléphone joueur 1,Nom joueur 2,Prénom joueur 2,Date de naissance joueur 2,Licence joueur 2,Club joueur 2,Classement joueur 2,Mail joueur 2,Téléphone joueur 2,Poids paire
Double Messieurs Senior,Senior,1,BARONI,Alexandre,08/02/1991,3742175,TENNIS CLUB LA FOURRAGERE ASPTT,5571,baroni.alexandre@hotmail.fr,0699624998,GIANGRECO,Laurent,20/10/1994,2106226,TENNIS CLUB LA FOURRAGERE ASPTT,11628,giangreco.laurent@laposte.net,0661970108,17199
Double Messieurs Senior,Senior,2,HAMANDJIAN,David,18/11/1992,2720301,COMITE BOUCHES DU RHONE TENNIS,11299,david.hamandjian@sfr.fr,0676448629,MICHELSEN,Pierre,02/05/1991,3082094,TENNIS CLUB LA FOURRAGERE ASPTT,7500,pierre.michelsen@gmail.com,0777690914,18799
Double Messieurs Senior,Senior,3,BERNE,Tanguy,07/01/2001,2729908,TENNIS CLUB LA FOURRAGERE ASPTT,7338,tanguy.berne@gmx.fr,0626564689,BEZIERS,Florian,01/03/2000,3732968,TENNIS CLUB LA FOURRAGERE ASPTT,14850,beziersflorian@gmail.com,0673128667,22188
Double Messieurs Senior,Senior,4,SCOLA,Alexis,01/12/1992,3239985,TENNIS CLUB LA FOURRAGERE ASPTT,13682,alexis.scola@gmail.com,0612250366,LAMOUR,Gabriel,05/02/2010,988276,TENNIS CLUB LA FOURRAGERE ASPTT,14617,Lamour_g@icloud.com,0769537935,28299
Double Messieurs Senior,Senior,5,PARISI,Pascal,04/05/1981,4320632,TENNIS CLUB LA FOURRAGERE ASPTT,14309,parisi.immo@gmail.com,+33762900405,POULET,Médéric,13/08/1973,249003,TENNIS CLUB LA FOURRAGERE ASPTT,35000,bleucitronprod@yahoo.fr,0618772882,49309
Double Messieurs Senior,Senior,6,MARCANTELLI,Alexandre,19/06/2007,9001416,TENNIS CLUB LA FOURRAGERE ASPTT,60170,alexandremarcantelli@gmail.com,0749036118,SUZZONI,Jean-françois,11/03/2007,6333660,TENNIS CLUB LA FOURRAGERE ASPTT,12500,jeff.suzzoni@gmail.com,0761692164,72670
Double Messieurs Senior,Senior,7,TEUMA,Romain,30/10/1996,356234,TENNIS CLUB LA FOURRAGERE ASPTT,39332,romteum@laposte.net,0760576081,JOURNOLLEAU,Ludwig,21/11/1990,2751570,TENNIS CLUB LA FOURRAGERE ASPTT,62713,Journolleauludwig@yahoo.fr,0627807964,102045
Double Messieurs Senior,Senior,8,GIL,Bertrand,22/07/1978,8426352,T.C SAINT-JULIEN,131574,bd_gil@hotmail.com,0603357864,GUGLIELMO,Julien,17/04/1982,6994965,T.C SAINT-JULIEN,10000,julien.guglielmo@gmail.com,0616586279,141574
Double Messieurs Senior,Senior,9,SAGGIO,Julien,06/10/1999,3054738,CAP 7 PADEL,66834,juliensaggio6@gmail.com,+33621023515,SAGGIO,Alexandre,13/07/1995,3743306,CAP 7 PADEL,82014,alexandre.saggio@gmail.com,+33624786438,148848`;
