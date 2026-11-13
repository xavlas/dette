const { BASE, DEFAUTS, H, COMPTES_2025, simuler, pointDeDepart, effetImpot, effetTVA, effetSmic, effetRevenuUniversel } = DetteModel;

const nf = (d) => new Intl.NumberFormat('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmt = (v, d = 1) => nf(d).format(v);
const signe = (v, d = 1) => {
  const arrondi = Number(v.toFixed(d));
  return (arrondi > 0 ? '+' : arrondi < 0 ? '−' : '') + fmt(Math.abs(arrondi), d);
};
const pct = (v, d = 1) => fmt(v, d) + ' %';
const mds = (v) => fmt(v, 0) + ' Md€';
const points = (v, d = 1) => `${signe(v, d)} ${Math.abs(v) >= 2 ? 'points' : 'point'}`;

const ansMois = (v) => {
  const mois = Math.round(v * 12);
  return `${Math.floor(mois / 12)} ans${mois % 12 ? ` et ${mois % 12} mois` : ''}`;
};

const PIB_2024 = 2920;
const NOTES_POSTES = {
  defense: 'Engagement Otan de 2025 : 3,5 % du PIB en 2035, soit environ +7,6 %/an.',
  enseignement: 'Du primaire au supérieur, dont 64 Md€ pour le secondaire et 42 Md€ pour le primaire.',
  sante: 'Hôpital, soins de ville, médicaments.',
  retraites: 'Pensions de vieillesse. Les curseurs du groupe « Retraites » s’y ajoutent.',
  social: 'Chômage (49 Md€), famille, invalidité, logement, exclusion. Le revenu universel, net des aides qu’il remplace, s’y ajoute.',
  securite: 'Police, gendarmerie, justice, prisons, pompiers.',
  economie: 'Transports, aides aux entreprises, énergie, agriculture.',
  general: 'Administration générale, contribution à l’UE, recherche fondamentale. Hors intérêts.',
  cadre: 'Logement et équipements collectifs, environnement, culture et sport.',
};

const euros = (v) => nf(0).format(v) + ' €';

const GROUPES = [
  {
    titre: 'Économie',
    curseurs: [
      { id: 'croissance', nom: 'Croissance du PIB en volume', min: -1, max: 3, pas: 0.1, f: (v) => pct(v) + '/an',
        repere: 'Rythme moyen sur 10 ans, hors inflation.' },
      { id: 'inflation', nom: 'Inflation', min: 0, max: 5, pas: 0.1, f: (v) => pct(v) + '/an',
        repere: 'Avec 1,0 % de croissance et 1,4 % d’inflation, le déficit stabilisant est d’environ 2,8 % du PIB (Cour des comptes).' },
      { id: 'tauxMarche', nom: 'Taux d’emprunt de l’État', min: 0, max: 8, pas: 0.1, f: (v) => pct(v),
        repere: 'Sénat : +1 point coûte 13,9 Md€ par an au bout de 3 ans, 32,6 Md€ au bout de 9 ans.' },
      { id: 'productivite', nom: 'Rattrapage de productivité', min: 0, max: 100, pas: 5, f: (v) => fmt(v, 0) + ' % de l’écart',
        repere: 'Banque de France : productivité 8,5 % sous sa tendance pré-Covid. Rattrapage étalé sur 10 ans.' },
    ],
  },
  {
    titre: 'Dépenses',
    curseurs: [
      { id: 'depenses', nom: 'Dépense publique hors intérêts, en volume', min: -1, max: 3, pas: 0.1, f: (v) => pct(v) + '/an',
        repere: 'Plan 2025-2029 : plafond de 1,2 % en valeur, soit environ −0,2 % en volume.' },
      { id: 'economies', nom: 'Économies pérennes supplémentaires', min: 0, max: 150, pas: 5, f: (v) => mds(v),
        repere: 'En Md€ de 2026, atteints en 3 ans. Budget 2027 : 54 Md€ d’effort annoncés.' },
    ],
  },
  {
    titre: 'Dépenses par poste',
    intro: 'Rythme de chaque poste en volume. Sans réglage, tous suivent le rythme général ci-dessus.',
    curseurs: H.postes.map((q) => ({
      id: 'poste_' + q.id, nom: q.nom, min: -4, max: 8, pas: 0.1,
      f: (v, p) => signe(p.depenses + v) + ' %/an',
      repere: `${fmt(q.montant, 0)} Md€ en 2024, soit ${pct(q.montant / PIB_2024 * 100)} du PIB. ${NOTES_POSTES[q.id]}`,
    })),
  },
  {
    titre: 'Recettes',
    curseurs: [
      { id: 'prelevements', nom: 'Taux de recettes publiques', min: -3, max: 3, pas: 0.1, f: (v) => signe(v) + ' pt de PIB',
        repere: 'Insee : recettes à 52,1 % du PIB en 2025, dont 43,6 % de prélèvements obligatoires.' },
      { id: 'niches', nom: 'Niches fiscales supprimées', min: 0, max: 100, pas: 5, f: (v) => fmt(v, 0) + ' %',
        repere: 'PLF 2026 : 88,3 Md€. Gain net retenu : la moitié du coût affiché.' },
      { id: 'fraude', nom: 'Fraude recouvrée en plus', min: 0, max: 20, pas: 0.5, f: (v) => '+' + fmt(v) + ' Md€/an',
        repere: 'Contrôle fiscal 2025 : 17,1 Md€ notifiés, 11,4 Md€ encaissés.' },
    ],
  },
  {
    titre: 'Aides aux entreprises',
    intro: 'Sénat : 211 Md€ en 2023, dont 88 Md€ de dépenses fiscales (curseur « niches ») et 41 Md€ de prêts et garanties Bpifrance, non comptés ici. Le Haut-commissariat au Plan retient de 82 à 187 Md€ selon le périmètre.',
    resume: (p) => {
      const gain = H.allegementsTotal * H.allegementsRendement * p.allegements / 100 + H.subventionsTotal * p.subventions / 100;
      return Math.abs(gain) < 0.05 ? 'Aides inchangées.' : `Effet à terme : ${signe(gain)} Md€ par an, en euros de 2026.`;
    },
    curseurs: [
      { id: 'allegements', nom: 'Allègements de cotisations supprimés', min: 0, max: 100, pas: 5, f: (v) => fmt(v, 0) + ' %',
        repere: `Sénat : ${fmt(H.allegementsTotal, 0)} Md€ en 2023, surtout sur les bas salaires. Gain net retenu : ${fmt(H.allegementsRendement * 100, 0)} %, le reste étant perdu en emplois.` },
      { id: 'subventions', nom: 'Subventions de l’État supprimées', min: 0, max: 100, pas: 5, f: (v) => fmt(v, 0) + ' %',
        repere: `Sénat : ${fmt(H.subventionsTotal, 0)} Md€ en 2023. Imputées au poste « Affaires économiques ».` },
    ],
  },
  {
    titre: 'TVA',
    intro: 'Quatre taux en vigueur. Effet immédiat, calculé à consommation inchangée.',
    resume: (p) => {
      const gain = effetTVA(p);
      return Math.abs(gain) < 0.05 ? 'Taux inchangés.' : `Effet : ${signe(gain)} Md€ par an, en euros de 2026.`;
    },
    curseurs: [
      { id: 'tva20', nom: 'Taux normal', min: 15, max: 25, pas: 0.5, f: (v) => pct(v),
        repere: 'Actuel : 20 %. La plupart des biens et services. Un point = 7,5 Md€ (Trésor).' },
      { id: 'tva10', nom: 'Taux intermédiaire', min: 5.5, max: 20, pas: 0.5, f: (v) => pct(v),
        repere: 'Actuel : 10 %. Restauration, transports, travaux. Un point = 1,6 Md€.' },
      { id: 'tva55', nom: 'Taux réduit', min: 0, max: 10, pas: 0.5, f: (v) => pct(v),
        repere: 'Actuel : 5,5 %. Alimentation, énergie, livres. Un point = 2,0 Md€.' },
      { id: 'tva21', nom: 'Taux particulier', min: 0, max: 5.5, pas: 0.1, f: (v) => pct(v),
        repere: 'Actuel : 2,1 %. Médicaments remboursés, presse. Un point = 0,4 Md€.' },
    ],
  },
  {
    titre: 'Impôt sur le revenu et hauts patrimoines',
    intro: `Barème proposé pour 2027, par part de quotient familial : 0 % jusqu’à ${euros(H.ir.seuils[0])}, puis les quatre tranches ci-dessous.`,
    resume: (p) => {
      const gain = effetImpot(p);
      return Math.abs(gain) < 0.05 ? 'Barème inchangé.' : `Effet à terme : ${signe(gain)} Md€ par an, en euros de 2026.`;
    },
    curseurs: [
      { id: 'ir11', nom: `De ${euros(H.ir.seuils[0])} à ${euros(H.ir.seuils[1])}`, min: 5, max: 20, pas: 0.5, f: (v) => pct(v),
        repere: 'Tranche à 11 %. Un point ≈ 3,5 Md€ : tous les foyers imposables la traversent.' },
      { id: 'ir30', nom: `De ${euros(H.ir.seuils[1])} à ${euros(H.ir.seuils[2])}`, min: 20, max: 40, pas: 0.5, f: (v) => pct(v),
        repere: 'Tranche à 30 %. Un point ≈ 1,15 Md€. Environ 16 % des foyers l’atteignent.' },
      { id: 'ir41', nom: `De ${euros(H.ir.seuils[2])} à ${euros(H.ir.seuils[3])}`, min: 30, max: 60, pas: 0.5, f: (v) => pct(v),
        repere: 'Tranche à 41 %. Un point ≈ 0,3 Md€. Environ 1,3 % des foyers.' },
      { id: 'ir45', nom: `Au-delà de ${euros(H.ir.seuils[3])}`, min: 35, max: 75, pas: 0.5, f: (v) => pct(v),
        repere: 'Tranche à 45 %. Un point ≈ 0,13 Md€. Environ 0,2 % des foyers (67 000). Sa création en 2013 a rapporté 344 M€.' },
      { id: 'irSurtaxe', nom: 'Nouvelle tranche supérieure', min: 0, max: 30, pas: 1, f: (v, p) => (v ? `${pct(p.ir45 + v)} (+${v} pts)` : 'aucune'),
        repere: 'Taux ajouté à celui de la dernière tranche, au-delà du seuil ci-dessous.' },
      { id: 'irSeuil', nom: 'Seuil de la nouvelle tranche', min: 200000, max: 2000000, pas: 50000, f: (v) => euros(v),
        repere: 'Par part. Plus le seuil est haut, moins il reste de revenus à taxer.', actifSi: (p) => p.irSurtaxe > 0 },
      { id: 'patrimoine', nom: 'Impôt plancher sur les patrimoines de plus de 100 M€', min: 0, max: 3, pas: 0.1, f: (v) => (v ? pct(v) + ' par an' : 'aucun'),
        repere: 'Proposition dite Zucman à 2 % : environ 1 800 foyers, 15 à 25 Md€ selon son auteur, autour de 5 Md€ selon ses critiques.' },
      { id: 'erosion', nom: 'Réaction des contribuables', min: 0, max: 80, pas: 5, f: (v) => `−${fmt(v, 0)} % du gain`,
        repere: 'Part du gain perdue par départs, optimisation ou moindre activité. S’applique aux hausses sur les tranches à 41 % et plus et sur les patrimoines.',
        actifSi: (p) => p.ir41 > 41 || p.ir45 > 45 || p.irSurtaxe > 0 || p.patrimoine > 0 },
    ],
  },
  {
    titre: 'Retraites',
    curseurs: [
      { id: 'ageLegal', nom: 'Âge légal de départ', min: -2, max: 3, pas: 0.25, f: (v) => ansMois(64 + v),
        repere: 'Référence : 64 ans (réforme 2023). Cour des comptes : 65 ans rapporte 17,7 Md€ en 2035, 63 ans coûte 13 Md€.' },
      { id: 'dureeAssurance', nom: 'Durée de cotisation pour le taux plein', min: -2, max: 2, pas: 0.25, f: (v) => `${ansMois(43 + v)} (${fmt((43 + v) * 4, 0)} trimestres)`,
        repere: 'Référence : 43 ans. Cour des comptes : 44 ans rapporte 9,7 Md€ en 2035, 42 ans coûte 7,1 Md€.' },
      { id: 'cotisation', nom: 'Taux de cotisation retraite', min: -1, max: 3, pas: 0.1, f: (v) => points(v),
        repere: 'Cour des comptes : un point rapporte 4,8 à 7,6 Md€ par an (6,2 retenus), mais renchérit le travail.' },
      { id: 'sousIndexation', nom: 'Pensions revalorisées sous l’inflation', min: 0, max: 2, pas: 0.1, f: (v) => (v ? '−' + fmt(v) + ' pt/an' : 'non'),
        repere: 'Cour des comptes : un point de moins économise 2,9 Md€ par an, acquis les années suivantes.' },
      { id: 'anneesSousIndexation', nom: 'Durée de la sous-indexation', min: 1, max: 10, pas: 1, f: (v) => `${v} an${v > 1 ? 's' : ''}`,
        repere: 'À partir de 2027.', actifSi: (p) => p.sousIndexation > 0 },
      { id: 'retraites', nom: 'Dérive du solde des retraites', min: 0, max: 300, pas: 10, f: (v) => fmt(v, 0) + ' % du scénario COR',
        repere: 'COR 2025 : −0,1 point de PIB en 2024, −0,2 en 2030, −1,4 en 2070.' },
    ],
  },
  {
    titre: 'Emploi et vieillissement',
    curseurs: [
      { id: 'chomage', nom: 'Taux de chômage visé', min: 4, max: 11, pas: 0.1, f: (v) => pct(v),
        repere: 'Référence : 7,4 %. Atteindre 5 % rapporterait 30 à 40 Md€ par an (35 retenus), en 5 ans.' },
      { id: 'seniors', nom: 'Taux d’emploi des 55-64 ans', min: 0, max: 10, pas: 0.5, f: (v) => points(v),
        repere: 'DARES : 60,4 % en 2024. Hypothèse de l’application : +0,2 % de PIB par point, en 10 ans. Recoupe en partie l’âge légal.' },
      { id: 'autonomie', nom: 'Dépenses d’autonomie en 2070', min: 1.9, max: 4.8, pas: 0.1, f: (v) => pct(v) + ' du PIB',
        repere: 'Ageing Report : 1,9 % en 2022 ; 2,6 % (référence) à 4,8 % (risque) en 2070.' },
    ],
  },
  {
    titre: 'SMIC',
    intro: 'Hausse ajoutée à la revalorisation légale annuelle. Environ 3,1 millions de salariés sont au SMIC (DARES).',
    resume: (p) => {
      const s = effetSmic(p);
      if (!p.smic) return 'SMIC revalorisé selon la règle légale.';
      const solde = s.recettes - s.depenses - (H.chomagePoint[0] + H.chomagePoint[1]) * s.chomage;
      return `Chômage ${points(s.chomage, 2)}. Effet à terme sur le solde : ${signe(solde)} Md€ par an, en euros de 2026.`;
    },
    curseurs: [
      { id: 'smic', nom: 'Hausse du SMIC', min: 0, max: 25, pas: 1,
        f: (v) => (v ? `+${v} % (≈ ${euros(H.smic.netMensuel * (1 + v / 100))} nets)` : 'aucune'),
        repere: `Environ ${euros(H.smic.netMensuel)} nets par mois en 2026. Par point : +${fmt(H.smic.recettesPoint, 2)} Md€ de cotisations et d’impôts, −${fmt(H.smic.allegementsPoint)} Md€ d’allègements en plus, −${fmt(H.smic.publicPoint)} Md€ de salaires publics.` },
      { id: 'smicEmplois', nom: 'Emplois perdus par point de hausse', min: 0, max: 40, pas: 1,
        f: (v) => (v ? `${fmt(v * 1000, 0)} emplois` : 'aucun'),
        repere: 'Hypothèse débattue : les estimations vont de presque rien à plusieurs dizaines de milliers d’emplois par point. Les emplois perdus passent par le levier « chômage ».',
        actifSi: (p) => p.smic > 0 },
    ],
  },
  {
    titre: 'Revenu universel',
    intro: 'Versé à chaque résident, sans condition. Il remplace les aides non contributives à hauteur de son montant ; retraites et allocations chômage ne sont pas touchées.',
    resume: (p) => {
      const r = effetRevenuUniversel(p);
      if (r.brut < 0.05) return 'Aucun revenu universel.';
      const pib = (v) => pct((v / BASE.pib) * 100);
      return `Coût brut ${mds(r.brut)}, aides supprimées −${mds(r.aides)}, coût net ${mds(r.net)} par an (${pib(r.net)} du PIB)`
        + (r.financement > 0.05 ? `, dont ${mds(r.financement)} couverts par le prélèvement dédié.` : '.');
    },
    curseurs: [
      { id: 'ruAdulte', nom: 'Montant par adulte', min: 0, max: 1200, pas: 50, f: (v) => (v ? euros(v) + '/mois' : 'aucun'),
        repere: `${fmt(H.ru.adultes)} millions d’adultes : 100 € par mois coûtent ${mds(H.ru.adultes * 1.2)} par an. Pour mémoire, RSA d’une personne seule : environ 650 €.` },
      { id: 'ruMineur', nom: 'Montant par mineur', min: 0, max: 600, pas: 25, f: (v) => (v ? euros(v) + '/mois' : 'aucun'),
        repere: `${fmt(H.ru.mineurs)} millions de mineurs, versé aux parents. Remplace les prestations familiales.` },
      { id: 'ruAides', nom: 'Aides supprimées en contrepartie', min: 0, max: 100, pas: 5, f: (v) => fmt(v, 0) + ' % de l’absorbable',
        repere: 'Une aide est supprimée en proportion du revenu universel rapporté à son montant moyen : RSA, prime d’activité, AAH, minimum vieillesse, ASS, la moitié des aides au logement, 80 % des prestations familiales.',
        actifSi: (p) => p.ruAdulte > 0 || p.ruMineur > 0 },
      { id: 'ruFinancement', nom: 'Part financée par un prélèvement dédié', min: 0, max: 100, pas: 5, f: (v) => fmt(v, 0) + ' %',
        repere: 'Impôt proportionnel sur tous les revenus, par exemple. Calculé sans effet sur l’activité.',
        actifSi: (p) => p.ruAdulte > 0 || p.ruMineur > 0 },
    ],
  },
  {
    titre: 'Chocs',
    curseurs: [
      { id: 'climat', nom: 'Risque climat matérialisé', min: 0, max: 100, pas: 5, f: (v) => fmt(v, 0) + ' %',
        repere: 'France Stratégie : +10 points de dette en 2030, +15 en 2035. Ampleur contestée.' },
      { id: 'crise', nom: 'Coût d’une crise', min: 0, max: 600, pas: 25, f: (v) => (v ? mds(v) : 'aucune'),
        repere: 'Subprimes, Covid, énergie : +200 à +600 Md€ de dette à chaque choc.' },
      { id: 'anneeCrise', nom: 'Année de la crise', min: 2027, max: 2035, pas: 1, f: (v) => String(v),
        repere: 'Coût réparti 60 % / 40 % sur deux ans, avec recul du PIB.', actifSi: (p) => p.crise > 0 },
    ],
  },
];

const PREREGLAGES = [
  { nom: 'Tendanciel', p: {} },
  { nom: 'Plan budgétaire', p: { depenses: -0.2 } },
  { nom: 'Taux élevés', p: { tauxMarche: 5.5 } },
  { nom: 'Croissance forte', p: { croissance: 2.0, productivite: 50 } },
  { nom: 'Retraite à 65 ans', p: { ageLegal: 1 } },
  // Proposition de l'assistant : aucun levier poussé à l'extrême, la dette plafonne vers 2030.
  { nom: 'Effort partagé', p: {
    depenses: 0.3, poste_defense: 2.5, poste_enseignement: 0.6,
    prelevements: 0.7, niches: 20, fraude: 3,
    dureeAssurance: 0.5, sousIndexation: 0.4, anneesSousIndexation: 4,
    chomage: 6.2, seniors: 4,
  } },
  { nom: 'Taxer les hauts revenus', p: { ir41: 45, ir45: 50, irSurtaxe: 10, irSeuil: 500000, patrimoine: 2 } },
  { nom: 'SMIC +10 %', p: { smic: 10 } },
  { nom: 'Revenu universel', p: { ruAdulte: 600, ruMineur: 150, ruFinancement: 50 } },
  { nom: 'Crise en 2029', p: { crise: 300, anneeCrise: 2029 } },
];

const CURSEURS = GROUPES.flatMap((g) => g.curseurs);
let params = lireAdresse();
const tendanciel = [pointDeDepart(), ...simuler(DEFAUTS)];

function lireAdresse() {
  const p = { ...DEFAUTS };
  for (const [k, v] of new URLSearchParams(location.hash.slice(1))) {
    const c = CURSEURS.find((x) => x.id === k);
    const n = Number(v);
    if (c && Number.isFinite(n)) p[k] = Math.min(c.max, Math.max(c.min, n));
  }
  return p;
}

function ecrireAdresse() {
  const q = new URLSearchParams();
  for (const c of CURSEURS) if (params[c.id] !== DEFAUTS[c.id]) q.set(c.id, params[c.id]);
  history.replaceState(null, '', q.size ? '#' + q : location.pathname + location.search);
}

function construireCurseurs() {
  const racine = document.getElementById('curseurs');
  for (const g of GROUPES) {
    const bloc = document.createElement('details');
    bloc.className = 'groupe';
    // Seuls le premier groupe et ceux déjà modifiés sont dépliés au chargement.
    bloc.open = g === GROUPES[0] || g.curseurs.some((c) => params[c.id] !== DEFAUTS[c.id]);
    g.bloc = bloc;
    bloc.innerHTML = `<summary>${g.titre}<span class="pastille-groupe" hidden></span></summary>${g.intro ? `<p class="repere">${g.intro}</p>` : ''}`;
    if (g.resume) {
      const r = document.createElement('p');
      r.className = 'resume';
      g.elementResume = r;
      bloc.appendChild(r);
    }
    for (const c of g.curseurs) {
      const div = document.createElement('div');
      div.className = 'curseur';
      div.id = 'c-' + c.id;
      div.innerHTML = `
        <div class="ligne"><label for="i-${c.id}">${c.nom}</label><output for="i-${c.id}"></output></div>
        <input type="range" id="i-${c.id}" min="${c.min}" max="${c.max}" step="${c.pas}">
        <p class="repere">${c.repere}</p>`;
      div.querySelector('input').addEventListener('input', (e) => {
        params[c.id] = Number(e.target.value);
        rendre();
      });
      bloc.appendChild(div);
    }
    racine.appendChild(bloc);
  }
}

function construirePrereglages() {
  const racine = document.getElementById('prereglages');
  for (const s of PREREGLAGES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = s.nom;
    b.addEventListener('click', () => {
      params = { ...DEFAUTS, ...s.p };
      for (const g of GROUPES) if (g.curseurs.some((c) => params[c.id] !== DEFAUTS[c.id])) g.bloc.open = true;
      rendre();
    });
    racine.appendChild(b);
  }
}

function majCurseurs() {
  for (const c of CURSEURS) {
    const div = document.getElementById('c-' + c.id);
    div.querySelector('input').value = params[c.id];
    div.querySelector('output').textContent = c.f(params[c.id], params);
    div.classList.toggle('modifie', params[c.id] !== DEFAUTS[c.id]);
    div.classList.toggle('inactif', c.actifSi ? !c.actifSi(params) : false);
  }
  for (const g of GROUPES) {
    if (g.resume) g.elementResume.textContent = g.resume(params);
    const modifies = g.curseurs.filter((c) => params[c.id] !== DEFAUTS[c.id] && !(c.actifSi && !c.actifSi(params))).length;
    const pastille = g.bloc.querySelector('.pastille-groupe');
    pastille.hidden = !modifies;
    pastille.textContent = modifies;
    pastille.title = `${modifies} curseur${modifies > 1 ? 's' : ''} modifié${modifies > 1 ? 's' : ''}`;
  }
  const boutons = document.querySelectorAll('#prereglages button');
  PREREGLAGES.forEach((s, i) => {
    const cible = { ...DEFAUTS, ...s.p };
    // Un curseur inactif (année de crise sans crise, par exemple) ne compte pas.
    const egal = CURSEURS.every((c) => params[c.id] === cible[c.id] || (c.actifSi && !c.actifSi(params) && !c.actifSi(cible)));
    boutons[i].setAttribute('aria-pressed', egal);
  });
}

function verdict(t) {
  const debut = t[0], fin = t[t.length - 1], avant = t[t.length - 2];
  const pic = t.reduce((a, b) => (b.ratio > a.ratio ? b : a));
  if (fin.ratio < debut.ratio) {
    return { etat: 'bon', icone: '✓', texte: `Dette en baisse : pic à ${pct(pic.ratio)} en ${pic.annee}` };
  }
  if (fin.ratio <= avant.ratio) {
    return { etat: 'alerte', icone: '!', texte: `Stabilisée après un pic à ${pct(pic.ratio)} en ${pic.annee}` };
  }
  return { etat: 'critique', icone: '×', texte: `En dérive : ${points(fin.ratio - avant.ratio)} en ${fin.annee}` };
}

function majTuiles(t) {
  const debut = t[0], fin = t[t.length - 1];
  const ref = tendanciel[tendanciel.length - 1];
  const v = verdict(t);
  const ecart = fin.ratio - ref.ratio;
  const vsTendanciel = Math.abs(ecart) < 0.05 ? 'identique au tendanciel' : `${points(ecart)} vs tendanciel`;
  document.getElementById('tuiles').innerHTML = `
    <div class="tuile hero">
      <div class="libelle">Dette en ${fin.annee}</div>
      <div class="valeur">${pct(fin.ratio)} <span class="libelle">du PIB</span></div>
      <div class="detail">${points(fin.ratio - debut.ratio)} depuis ${debut.annee} (${pct(debut.ratio)}) · ${vsTendanciel}</div>
      <div class="verdict" data-etat="${v.etat}"><span class="pastille" aria-hidden="true">${v.icone}</span>${v.texte}</div>
    </div>
    <div class="tuile">
      <div class="libelle">Encours en ${fin.annee}</div>
      <div class="valeur">${mds(fin.dette)}</div>
      <div class="detail">${signe(fin.dette - debut.dette, 0)} Md€ en 10 ans</div>
    </div>
    <div class="tuile">
      <div class="libelle">Charge d’intérêts en ${fin.annee}</div>
      <div class="valeur">${mds(fin.interets)}</div>
      <div class="detail">${pct(fin.interetsPib)} du PIB, contre ${pct(debut.interetsPib)} en ${debut.annee}</div>
    </div>
    <div class="tuile">
      <div class="libelle">Solde public en ${fin.annee}</div>
      <div class="valeur">${signe(fin.soldePib)} %</div>
      <div class="detail">Solde stabilisant : ${signe(fin.soldeStabilisant)} % du PIB</div>
    </div>`;
}

const css = (nom) => `var(--${nom})`;
const legende = (id, items) => {
  document.getElementById(id).innerHTML = items.map(([nom, couleur]) => `<span><i style="background:${css(couleur)}"></i>${nom}</span>`).join('');
};

function majGraphiques(t) {
  const identique = t.every((a, i) => Math.abs(a.ratio - tendanciel[i].ratio) < 1e-9);
  const mesure = { x: 2025, y: COMPTES_2025.ratio };
  Graphiques.courbes(document.getElementById('g-ratio'), {
    description: 'Dette publique en pourcentage du PIB, de 2025 à 2036, votre scénario comparé au tendanciel',
    format: (v) => pct(v), formatAxe: (v) => fmt(v, 0) + ' %',
    series: [
      { nom: 'Tendanciel', couleur: css('reference'), etiquette: !identique, points: [mesure, ...tendanciel.map((a) => ({ x: a.annee, y: a.ratio }))] },
      { nom: 'Votre scénario', couleur: css('serie-1'), points: [mesure, ...t.map((a) => ({ x: a.annee, y: a.ratio }))] },
    ],
  });
  legende('legende-ratio', [['Votre scénario', 'serie-1'], ['Tendanciel', 'reference']]);

  const projete = t.slice(1);
  Graphiques.courbes(document.getElementById('g-solde'), {
    hauteur: 260,
    description: 'Solde public et solde stabilisant en pourcentage du PIB, de 2027 à 2036',
    format: (v) => signe(v) + ' %', formatAxe: (v) => signe(v, 0) + ' %',
    series: [
      { nom: 'Solde stabilisant', couleur: css('serie-2'), points: projete.map((a) => ({ x: a.annee, y: a.soldeStabilisant })) },
      { nom: 'Solde public', couleur: css('serie-1'), points: projete.map((a) => ({ x: a.annee, y: a.soldePib })) },
    ],
  });
  legende('legende-solde', [['Solde public', 'serie-1'], ['Solde stabilisant', 'serie-2']]);

  Graphiques.colonnes(document.getElementById('g-interets'), {
    description: 'Charge d’intérêts annuelle en milliards d’euros, de 2026 à 2036',
    couleur: css('serie-1'), format: (v) => fmt(v, 0), formatAxe: (v) => fmt(v, 0),
    points: t.map((a) => ({
      x: a.annee, y: a.interets,
      detail: `<div><span>Intérêts</span><span>${mds(a.interets)}</span></div>
        <div><span>En % du PIB</span><span>${pct(a.interetsPib)}</span></div>
        <div><span>Taux moyen de la dette</span><span>${pct(a.tauxMoyen, 2)}</span></div>`,
    })),
  });
  const fin = t[t.length - 1];
  document.getElementById('note-interets').textContent =
    `Taux moyen payé sur la dette : ${pct(t[0].tauxMoyen, 2)} en ${t[0].annee}, ${pct(fin.tauxMoyen, 2)} en ${fin.annee}.`;
}

function majPostes(t) {
  const debut = t[0], fin = t[t.length - 1];
  const part = (a, id) => (a.postes[id] / a.pib) * 100;
  const max = Math.max(...H.postes.flatMap((q) => [part(debut, q.id), part(fin, q.id)]));
  const lignes = H.postes.map((q) => {
    const avant = part(debut, q.id), apres = part(fin, q.id);
    return `
      <div class="poste">
        <span class="nom">${q.nom}</span>
        <span class="piste" title="${debut.annee} : ${pct(avant)} du PIB">
          <span class="barre" style="width:${(apres / max) * 100}%"></span>
          <span class="repere-depart" style="left:${(avant / max) * 100}%"></span>
        </span>
        <span class="chiffres"><b>${pct(apres)}</b> ${signe(apres - avant)} pt · ${mds(fin.postes[q.id])}</span>
      </div>`;
  }).join('');
  const reste = fin.nonVentile;
  document.getElementById('postes').innerHTML = lignes + (Math.abs(reste) < 0.5 ? '' :
    `<p class="note">Non ventilé (économies transversales, SMIC des agents publics, climat, crise) : ${signe(reste, 0)} Md€ en ${fin.annee}.</p>`);
}

function majTableau(t) {
  const lignes = t.map((a, i) => `
    <tr${i ? '' : ' class="depart"'}>
      <td>${a.annee}${i ? '' : ' (départ)'}</td>
      <td>${fmt(a.pib, 0)}</td>
      <td>${a.croissanceNominale === null ? '–' : pct(a.croissanceNominale)}</td>
      <td>${fmt(a.recettes, 0)}</td>
      <td>${fmt(a.depensesPrimaires, 0)}</td>
      <td>${signe(a.soldePrimairePib)} %</td>
      <td>${fmt(a.interets, 0)}</td>
      <td>${pct(a.tauxMoyen, 2)}</td>
      <td>${signe(a.soldePib)} %</td>
      <td>${a.soldeStabilisant === null ? '–' : signe(a.soldeStabilisant) + ' %'}</td>
      <td>${fmt(a.dette, 0)}</td>
      <td>${pct(a.ratio)}</td>
    </tr>`).join('');
  document.getElementById('tableau').innerHTML = `
    <thead><tr>
      <th>Année</th><th>PIB (Md€)</th><th>Croissance en valeur</th><th>Recettes (Md€)</th>
      <th>Dépenses hors intérêts (Md€)</th><th>Solde primaire</th><th>Intérêts (Md€)</th><th>Taux moyen</th>
      <th>Solde public</th><th>Solde stabilisant</th><th>Dette (Md€)</th><th>Dette / PIB</th>
    </tr></thead><tbody>${lignes}</tbody>`;
}

function construireTextes() {
  const d = pointDeDepart();
  document.getElementById('methode').innerHTML = `
    <p>Chaque année, la dette augmente du déficit : dépenses hors intérêts, moins recettes, plus intérêts. Le PIB progresse de la croissance en volume et de l’inflation ; les recettes suivent le PIB ; les dépenses hors intérêts suivent leur propre rythme.</p>
    <p><strong>Point de départ estimé (fin ${d.annee}) :</strong> PIB ${mds(d.pib)}, dette ${mds(d.dette)} (${pct(d.ratio)} du PIB, projection de la Cour des comptes), déficit ${pct(-d.soldePib)} du PIB, intérêts ${mds(d.interets)}. Le dernier chiffre mesuré est celui de l’Insee pour fin 2025 : ${fmt(COMPTES_2025.dette)} Md€, ${pct(COMPTES_2025.ratio)} du PIB.</p>
    <p><strong>Hypothèses propres à l’application, non tirées des sources :</strong></p>
    <ul>
      <li>${fmt(H.refinancement * 100)} % de l’encours est refinancé chaque année au taux de marché, et toute dette nouvelle l’est en totalité. Ce réglage reproduit les trois chiffres du Sénat à 15 % près.</li>
      <li>Supprimer une niche fiscale rapporte ${fmt(H.nichesRendement * 100, 0)} % de son coût affiché.</li>
      <li>Supprimer des allègements de cotisations patronales rapporte ${fmt(H.allegementsRendement * 100, 0)} % de leur montant : le reste est perdu en emplois et en salaires. Les subventions supprimées sont des économies nettes.</li>
      <li>Un point de taux d’emploi des seniors ajoute ${fmt(H.pibParPointSeniors)} % au PIB.</li>
      <li>La dépense hors intérêts de 2026 est répartie entre postes selon leur poids de 2024 (Eurostat). L’objectif Otan de 3,5 % du PIB cité pour la défense ne vient pas des sources du site.</li>
      <li>Les rendements par point de chaque tranche de l’impôt sur le revenu sont des estimations de l’application, fiables à 30 % près : elles partent du nombre de foyers et de l’impôt moyen par tranche (DGFiP, revenus 2022) et des chiffrages cités par le Sénat. Le rendement de l’impôt plancher sur les patrimoines (10 Md€ bruts par point) vient du débat public de 2025, pas des sources du site.</li>
      <li>La TVA est calculée à consommation inchangée : une hausse ne réduit pas les achats et ne pèse pas sur la croissance, une baisse ne les stimule pas.</li>
      <li>Les effets de l’âge légal et de la durée de cotisation sont ceux de la Cour des comptes pour un an, étendus en proportion au-delà d’un an et atteints progressivement en 2035. Leur effet sur le PIB n’est compté que par les recettes.</li>
      <li>Un point de chômage en moins rapporte ${fmt(H.chomagePoint[0] + H.chomagePoint[1])} Md€ par an, en ${H.monteeChomage} ans, sans effet ajouté sur le PIB.</li>
      <li>Les effets par point de hausse du SMIC (recettes, allègements, salaires publics) sont des estimations de l’application, fiables à 50 % près. Les emplois perdus sont convertis en chômage sur une population active de ${fmt(H.smic.populationActive, 0)} millions. L’effet sur la consommation et sur la prime d’activité n’est pas compté.</li>
      <li>Le revenu universel est versé à toute la population et imputé au poste « Autre protection sociale ». Les montants des aides qu’il remplace (${mds(H.ru.aides.reduce((s, a) => s + a.montant, 0))} au total) sont des ordres de grandeur DREES et CNAF ; leur réduction suit le rapport entre le revenu universel et l’aide moyenne par foyer. Ni l’effet sur l’offre de travail, ni l’imposition du revenu universel ne sont modélisés.</li>
      <li>Les leviers budgétaires montent en charge sur ${H.montee} ans, puis suivent le PIB.</li>
      <li>Une crise réduit le PIB de 1 % par tranche de 100 Md€, dont la moitié est rattrapée l’année suivante.</li>
      <li>Le « tendanciel » maintient les dépenses hors intérêts au rythme de la croissance : ce n’est pas une prévision officielle.</li>
    </ul>
    <p><strong>Ce que le modèle ignore :</strong> l’effet des économies ou des hausses d’impôts sur la croissance, la réaction des taux au niveau de dette, les titres indexés sur l’inflation, les cessions d’actifs et les écarts entre déficit et variation de dette.</p>`;

  document.getElementById('sources').innerHTML = Object.values(SOURCES).map((s) => `
    <li><a href="${s.url}" target="_blank" rel="noopener">${s.nom}</a><br>${s.chiffre}
      <div class="usage">Usage : ${s.usage}</div></li>`).join('');
}

function rendre() {
  const t = [pointDeDepart(), ...simuler(params)];
  majCurseurs();
  majTuiles(t);
  majGraphiques(t);
  majPostes(t);
  majTableau(t);
  ecrireAdresse();
}

construireCurseurs();
construirePrereglages();
construireTextes();
rendre();
new ResizeObserver(() => majGraphiques([pointDeDepart(), ...simuler(params)])).observe(document.getElementById('g-ratio'));
window.addEventListener('hashchange', () => { params = lireAdresse(); rendre(); });
