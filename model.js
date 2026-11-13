// Modèle de projection de la dette publique française (périmètre Maastricht).
// Montants en Md€, taux et ratios en %. Aucune dépendance : utilisable dans le
// navigateur (window.DetteModel) comme sous Node (require).
(function (racine, fabrique) {
  if (typeof module === 'object' && module.exports) module.exports = fabrique();
  else racine.DetteModel = fabrique();
})(globalThis, function () {
  // Dernier exercice mesuré (Insee, Finances publiques 2025).
  const COMPTES_2025 = { dette: 3460.5, ratio: 115.6, deficit: 152.5, recettesPib: 52.1 };

  // Point de départ : fin 2026, estimé. PIB 2025 (dette / ratio) + 2,0 % en valeur ;
  // dette à 118,6 % du PIB (projection Cour des comptes) ; recettes au taux 2025 ;
  // déficit 5,0 % du PIB ; intérêts ~67 Md€ (PLF / AFT).
  const PIB_2026 = Math.round((COMPTES_2025.dette / COMPTES_2025.ratio) * 100 * 1.02);
  const BASE = (() => {
    const pib = PIB_2026;
    const recettes = pib * COMPTES_2025.recettesPib / 100;
    const interets = 67;
    return {
      annee: 2026,
      pib,
      dette: pib * 1.186,
      dettePrecedente: COMPTES_2025.dette,
      recettes,
      interets,
      depensesPrimaires: recettes + pib * 0.05 - interets,
    };
  })();

  // Hypothèses fixes, documentées dans l'interface.
  const H = {
    // Part de l'encours refinancée chaque année au taux de marché. Calée sur le
    // rapport du Sénat n° 719 (+100 pb = +13,9 / +24,0 / +32,6 Md€ à 3 / 6 / 9 ans).
    refinancement: 0.145,
    montee: 3,             // années de montée en charge des leviers
    nichesTotal: 88.3,     // PLF 2026, Voies et moyens
    nichesRendement: 0.5,  // gain net / coût brut d'une niche supprimée
    // Aides aux entreprises hors dépenses fiscales (déjà dans les niches) et hors
    // prêts et garanties Bpifrance. Commission d'enquête du Sénat, 2023, Md€.
    allegementsTotal: 75,       // allègements de cotisations sociales
    allegementsRendement: 0.5,  // gain net / montant, après emplois peu qualifiés perdus
    subventionsTotal: 7,        // subventions de l'État
    ecartProductivite: 8.5, // Banque de France, % sous la tendance pré-Covid
    pibParPointSeniors: 0.2, // % de PIB par point de taux d'emploi 55-64 ans
    autonomie2022: 1.9,    // Ageing Report 2024, % du PIB
    // Dépenses par fonction en 2024, Md€ (Eurostat, gov_10a_exp), hors opérations
    // sur la dette (58,9 Md€). Sert à répartir la dépense hors intérêts de 2026.
    postes: [
      { id: 'defense', nom: 'Défense', montant: 54.2 },
      { id: 'enseignement', nom: 'Enseignement', montant: 148.6 },
      { id: 'sante', nom: 'Santé', montant: 261.2 },
      { id: 'retraites', nom: 'Retraites', montant: 392.0 },
      { id: 'social', nom: 'Autre protection sociale', montant: 301.0 },
      { id: 'securite', nom: 'Sécurité et justice', montant: 52.1 },
      { id: 'economie', nom: 'Affaires économiques', montant: 166.1 },
      { id: 'general', nom: 'Services généraux', montant: 122.2 },
      { id: 'cadre', nom: 'Logement, environnement, culture', montant: 115.5 },
    ],
    // Impôt sur le revenu. Seuils par part du barème proposé pour 2027 (PLF 2027).
    // parPoint : Md€ par point de taux de chaque tranche, estimations de l'application.
    ir: {
      taux: [11, 30, 41, 45],
      seuils: [11844, 30200, 86353, 185737],
      parPoint: [3.5, 1.15, 0.3, 0.13],
      pareto: 1.33, // décroissance de l'assiette au-delà du dernier seuil
    },
    // TVA : Md€ nets par point de chaque taux en 2025 (DG Trésor, septembre 2025).
    tva: { taux: [20, 10, 5.5, 2.1], parPoint: [7.5, 1.6, 2.0, 0.4] },
    patrimoineParPoint: 10, // Md€ bruts par point d'impôt plancher au-delà de 100 M€
    // Cour des comptes, système de retraites (février 2025). Effet en 2035 d'un an
    // de plus ou de moins, en Md€ : [solde des retraites, autres recettes publiques].
    age: { plus: [8.4, 9.3], moins: [5.8, 7.2] },
    duree: { plus: [5.2, 4.5], moins: [3.9, 3.2] },
    pleinEffet: 2035,
    cotisationPoint: 6.2,     // Md€ par point, milieu de la fourchette 4,8 à 7,6
    sousIndexationPoint: 2.9, // Md€ par point et par année, pensions de base
    // Scénario plein emploi de dettedelafrance.fr : de 7,4 % à 5 % de chômage,
    // 20-25 Md€ de recettes et 10-15 Md€ de prestations en moins.
    chomageRef: 7.4,
    chomagePoint: [12.5 / 2.4, 22.5 / 2.4], // Md€ par point : [dépenses, recettes]
    monteeChomage: 5,
    // Solde du système de retraite, % du PIB (COR, rapport 2025).
    cor: [[2024, -0.1], [2030, -0.2], [2070, -1.4]],
    // Risque climat sur la dette, points de PIB cumulés (France Stratégie, 2023).
    climat: [[2023, 0], [2030, 10], [2035, 15], [2040, 25]],
    // Hausse du SMIC au-delà de la revalorisation légale : Md€ de 2026 par point,
    // estimations de l'application (environ 3,1 millions de salariés au SMIC, DARES).
    smic: {
      netMensuel: 1440,      // € nets par mois en 2026, environ
      recettesPoint: 0.35,   // cotisations salariales, CSG et impôts sur le surcroît de salaire
      allegementsPoint: 0.6, // allègements de cotisations, calculés en fonction du SMIC
      publicPoint: 0.2,      // agents publics rémunérés au niveau du SMIC
      populationActive: 31,  // millions de personnes
    },
    // Revenu universel versé à chaque résident (population Insee 2025, millions).
    // Aides non contributives absorbées, Md€ par an (ordres de grandeur DREES et CNAF) :
    // part absorbée = min(1, montant du revenu universel / seuil) × plafond.
    ru: {
      adultes: 54.3,
      mineurs: 14.3,
      aides: [
        { id: 'rsa', nom: 'RSA', montant: 12.0, seuil: 540, plafond: 1, base: 'adultes' },
        { id: 'prime', nom: 'Prime d’activité', montant: 10.5, seuil: 190, plafond: 1, base: 'adultes' },
        { id: 'aah', nom: 'AAH', montant: 13.5, seuil: 1030, plafond: 1, base: 'adultes' },
        { id: 'aspa', nom: 'Minimum vieillesse', montant: 3.9, seuil: 465, plafond: 1, base: 'adultes' },
        { id: 'autres', nom: 'ASS et autres minima', montant: 2.5, seuil: 550, plafond: 1, base: 'adultes' },
        { id: 'logement', nom: 'Aides au logement', montant: 15.5, seuil: 225, plafond: 0.5, base: 'adultes' },
        { id: 'famille', nom: 'Prestations familiales', montant: 33.0, seuil: 190, plafond: 0.8, base: 'mineurs' },
      ],
    },
  };

  const DEFAUTS = {
    croissance: 1.0,   // PIB en volume, %/an
    inflation: 1.4,    // déflateur du PIB, %/an
    tauxMarche: 3.4,   // taux moyen à l'émission, %
    productivite: 0,   // % de l'écart de productivité rattrapé en 10 ans
    depenses: 1.0,     // dépense primaire en volume, %/an
    economies: 0,      // économies pérennes, Md€ de 2026
    prelevements: 0,   // variation du taux de recettes, points de PIB
    niches: 0,         // % des dépenses fiscales supprimées
    fraude: 0,         // recouvrement supplémentaire, Md€ de 2026 par an
    allegements: 0,    // % des allègements de cotisations patronales supprimés
    subventions: 0,    // % des subventions de l'État aux entreprises supprimées
    tva20: 20, tva10: 10, tva55: 5.5, tva21: 2.1, // taux de TVA, %
    ir11: 11, ir30: 30, ir41: 41, ir45: 45, // taux du barème, %
    irSurtaxe: 0,      // points ajoutés au-delà de irSeuil
    irSeuil: 500000,   // seuil de la nouvelle tranche, € par part
    patrimoine: 0,     // impôt plancher sur les patrimoines > 100 M€, %
    erosion: 30,       // % du gain sur les hauts revenus et patrimoines perdu par réaction
    ageLegal: 0,       // années de décalage de l'âge légal vs réforme 2023 (64 ans)
    dureeAssurance: 0, // années de cotisation en plus ou en moins vs 43 ans
    cotisation: 0,     // points de cotisation retraite
    sousIndexation: 0, // points de revalorisation des pensions sous l'inflation, par an
    anneesSousIndexation: 4,
    chomage: 7.4,      // taux de chômage visé, %
    retraites: 100,    // % de la dérive du scénario COR
    autonomie: 2.6,    // dépenses d'autonomie en 2070, % du PIB
    seniors: 0,        // points de taux d'emploi 55-64 ans gagnés en 10 ans
    climat: 0,         // % du risque France Stratégie matérialisé
    crise: 0,          // coût budgétaire d'une crise, Md€
    anneeCrise: 2029,
    smic: 0,           // hausse du SMIC au-delà de la revalorisation légale, %
    smicEmplois: 15,   // milliers d'emplois perdus par point de hausse
    ruAdulte: 0,       // revenu universel par adulte, € de 2026 par mois
    ruMineur: 0,       // revenu universel par mineur, € de 2026 par mois
    ruAides: 100,      // % des aides absorbables effectivement supprimées
    ruFinancement: 0,  // % du coût net couvert par un prélèvement dédié
  };

  // Écart de croissance en volume de chaque poste par rapport au rythme général, points/an.
  for (const q of H.postes) DEFAUTS['poste_' + q.id] = 0;
  const TOTAL_POSTES = H.postes.reduce((s, q) => s + q.montant, 0);

  function interpoler(points, x) {
    if (x <= points[0][0]) return points[0][1];
    for (let i = 1; i < points.length; i++) {
      const [x0, y0] = points[i - 1];
      const [x1, y1] = points[i];
      if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
    return points[points.length - 1][1];
  }

  // Recettes supplémentaires à terme, en Md€ de 2026.
  function effetImpot(params) {
    const p = { ...DEFAUTS, ...params };
    const [b11, b30, b41, b45] = H.ir.parPoint;
    const base = (p.ir11 - 11) * b11 + (p.ir30 - 30) * b30;
    const nouvelle = p.irSurtaxe * b45 * Math.pow(p.irSeuil / H.ir.seuils[3], -H.ir.pareto);
    const hauts = (p.ir41 - 41) * b41 + (p.ir45 - 45) * b45 + nouvelle
      + p.patrimoine * H.patrimoineParPoint;
    return base + hauts * (hauts > 0 ? 1 - p.erosion / 100 : 1);
  }

  // Recettes de TVA supplémentaires, en Md€ de 2026, à comportement inchangé.
  function effetTVA(params) {
    const p = { ...DEFAUTS, ...params };
    return [p.tva20, p.tva10, p.tva55, p.tva21]
      .reduce((s, taux, i) => s + (taux - H.tva.taux[i]) * H.tva.parPoint[i], 0);
  }

  // Effet à terme d'une hausse du SMIC, en Md€ de 2026 ; chômage en points.
  function effetSmic(params) {
    const p = { ...DEFAUTS, ...params };
    const s = H.smic;
    return {
      recettes: (s.recettesPoint - s.allegementsPoint) * p.smic,
      depenses: s.publicPoint * p.smic,
      chomage: (p.smic * p.smicEmplois / 1000 / s.populationActive) * 100,
    };
  }

  // Coût du revenu universel à terme, en Md€ de 2026 par an.
  function effetRevenuUniversel(params) {
    const p = { ...DEFAUTS, ...params };
    const brut = (H.ru.adultes * p.ruAdulte + H.ru.mineurs * p.ruMineur) * 12 / 1000;
    const parAide = H.ru.aides.map((a) => {
      const verse = a.base === 'mineurs' ? p.ruMineur : p.ruAdulte;
      return { ...a, absorbe: a.montant * a.plafond * Math.min(1, verse / a.seuil) * p.ruAides / 100 };
    });
    const aides = parAide.reduce((s, a) => s + a.absorbe, 0);
    const net = brut - aides;
    return { brut, aides, parAide, net, financement: Math.max(0, net) * p.ruFinancement / 100 };
  }

  function simuler(params, base = BASE, horizon = 10) {
    const p = { ...DEFAUTS, ...params };
    const tauxRecettes = base.recettes / base.pib;
    const trajectoire = [];

    let pib = base.pib;
    let dette = base.dette;
    let dettePrec = base.dettePrecedente;
    let tauxMoyen = base.interets / base.dettePrecedente;
    const postes = H.postes.map((q) => (base.depensesPrimaires * q.montant) / TOTAL_POSTES);
    const impot = effetImpot(p);
    const tva = effetTVA(p);
    const smic = effetSmic(p);
    const ru = effetRevenuUniversel(p);

    for (let k = 1; k <= horizon; k++) {
      const annee = base.annee + k;
      const montee = Math.min(1, k / H.montee);

      // Croissance
      let reel = p.croissance
        + (H.ecartProductivite * p.productivite / 100) / 10
        + (H.pibParPointSeniors * p.seniors) / 10;
      if (p.crise > 0 && annee === p.anneeCrise) reel -= p.crise / 100;
      if (p.crise > 0 && annee === p.anneeCrise + 1) reel += p.crise / 200;
      const nominal = (1 + reel / 100) * (1 + p.inflation / 100) - 1;
      const ratioPrec = (dette / pib) * 100;
      pib *= 1 + nominal;
      const echelle = pib / base.pib; // convertit les Md€ de 2026 en Md€ courants

      // Retraites et emploi, en Md€ de 2026 : [moindre dépense, recette en plus]
      const versPleinEffet = Math.min(1, k / Math.max(1, H.pleinEffet - base.annee));
      const unAn = (levier, annees) => (annees > 0 ? levier.plus : levier.moins)
        .map((v) => v * annees * versPleinEffet);
      const age = unAn(H.age, p.ageLegal);
      const duree = unAn(H.duree, p.dureeAssurance);
      const emploi = H.chomagePoint.map((v) =>
        v * (H.chomageRef - p.chomage - smic.chomage) * Math.min(1, k / H.monteeChomage));
      const pensions = H.sousIndexationPoint * p.sousIndexation * Math.min(k, p.anneesSousIndexation);
      const recetteEnPlus = age[1] + duree[1] + emploi[1] + H.cotisationPoint * p.cotisation * montee + tva;

      // Dépenses primaires
      H.postes.forEach((q, i) => {
        postes[i] *= (1 + (p.depenses + p['poste_' + q.id]) / 100) * (1 + p.inflation / 100);
      });
      const retraites = (interpoler(H.cor, base.annee) - interpoler(H.cor, annee)) * p.retraites / 100;
      const autonomie = ((p.autonomie - H.autonomie2022) / 48) * k;
      const climat = (interpoler(H.climat, annee) - interpoler(H.climat, annee - 1)) * p.climat / 100;
      let coutCrise = 0;
      if (p.crise > 0 && annee === p.anneeCrise) coutCrise = 0.6 * p.crise;
      if (p.crise > 0 && annee === p.anneeCrise + 1) coutCrise = 0.4 * p.crise;
      // Ventilation : les mesures identifiables sont rattachées à leur poste.
      const parPoste = {};
      H.postes.forEach((q, i) => { parPoste[q.id] = postes[i]; });
      parPoste.retraites += pib * retraites / 100 - (age[0] + duree[0] + pensions) * echelle;
      parPoste.social += pib * autonomie / 100 - emploi[0] * echelle;
      parPoste.economie -= H.subventionsTotal * p.subventions / 100 * montee * echelle;
      parPoste.social += ru.net * montee * echelle;
      const nonVentile = pib * climat / 100 + (smic.depenses - p.economies) * montee * echelle + coutCrise;
      const depensesPrimaires = Object.values(parPoste).reduce((s, v) => s + v, 0) + nonVentile;

      // Recettes
      const recettes = pib * (tauxRecettes + (p.prelevements / 100) * montee)
        + ((H.nichesTotal * H.nichesRendement * p.niches / 100 + p.fraude + impot
          + smic.recettes + ru.financement
          + H.allegementsTotal * H.allegementsRendement * p.allegements / 100) * montee + recetteEnPlus) * echelle;

      // Intérêts : l'ancien encours est repris pour partie au taux de marché,
      // la dette nouvelle l'est en totalité.
      const marche = p.tauxMarche / 100;
      const nouvelle = Math.max(0, dette - dettePrec);
      const ancienne = dette - nouvelle;
      tauxMoyen = (ancienne * ((1 - H.refinancement) * tauxMoyen + H.refinancement * marche)
        + nouvelle * marche) / dette;
      const interets = tauxMoyen * dette;

      const soldePrimaire = recettes - depensesPrimaires;
      const solde = soldePrimaire - interets;
      dettePrec = dette;
      dette -= solde;

      trajectoire.push({
        annee, pib, dette,
        ratio: (dette / pib) * 100,
        recettes, depensesPrimaires, interets, soldePrimaire, solde,
        postes: parPoste, nonVentile,
        soldePib: (solde / pib) * 100,
        soldePrimairePib: (soldePrimaire / pib) * 100,
        interetsPib: (interets / pib) * 100,
        tauxMoyen: tauxMoyen * 100,
        croissanceNominale: nominal * 100,
        soldeStabilisant: -ratioPrec * nominal / (1 + nominal),
      });
    }
    return trajectoire;
  }

  // Ligne « 2026 » au même format que la trajectoire, pour les graphiques.
  function pointDeDepart(base = BASE) {
    const soldePrimaire = base.recettes - base.depensesPrimaires;
    const solde = soldePrimaire - base.interets;
    const postes = {};
    for (const q of H.postes) postes[q.id] = (base.depensesPrimaires * q.montant) / TOTAL_POSTES;
    return {
      postes, nonVentile: 0,
      annee: base.annee, pib: base.pib, dette: base.dette,
      ratio: (base.dette / base.pib) * 100,
      recettes: base.recettes, depensesPrimaires: base.depensesPrimaires,
      interets: base.interets, soldePrimaire, solde,
      soldePib: (solde / base.pib) * 100,
      soldePrimairePib: (soldePrimaire / base.pib) * 100,
      interetsPib: (base.interets / base.pib) * 100,
      tauxMoyen: (base.interets / base.dettePrecedente) * 100,
      croissanceNominale: null, soldeStabilisant: null,
    };
  }

  return { COMPTES_2025, BASE, DEFAUTS, H, simuler, pointDeDepart, effetImpot, effetTVA, effetSmic, effetRevenuUniversel };
});
