// Reference list of Leyte LGUs for the Add/Edit LGU autocomplete, sourced
// from the official district breakdown (Leyte Provincial Government /
// COMELEC districting, via leytecentral). All 43 LGUs — 40 municipalities
// plus Tacloban City (HUC), Ormoc City (independent component city), and
// Baybay City — are mapped to their district.
//
// Plain array, no migration needed — edit directly if district lines are
// redrawn in the future.
export interface LeyteTown {
  name: string;
  district: string | null;
}

export const LEYTE_TOWNS: LeyteTown[] = [
  // --- 1st District ---
  { name: "Tacloban City", district: "1st District" },
  { name: "Alangalang", district: "1st District" },
  { name: "Babatngon", district: "1st District" },
  { name: "Palo", district: "1st District" },
  { name: "San Miguel", district: "1st District" },
  { name: "Sta. Fe", district: "1st District" },
  { name: "Tanauan", district: "1st District" },
  { name: "Tolosa", district: "1st District" },

  // --- 2nd District ---
  { name: "Barugo", district: "2nd District" },
  { name: "Burauen", district: "2nd District" },
  { name: "Capoocan", district: "2nd District" },
  { name: "Carigara", district: "2nd District" },
  { name: "Dagami", district: "2nd District" },
  { name: "Dulag", district: "2nd District" },
  { name: "Jaro", district: "2nd District" },
  { name: "Julita", district: "2nd District" },
  { name: "La Paz", district: "2nd District" },
  { name: "MacArthur", district: "2nd District" },
  { name: "Mayorga", district: "2nd District" },
  { name: "Pastrana", district: "2nd District" },
  { name: "Tabontabon", district: "2nd District" },
  { name: "Tunga", district: "2nd District" },

  // --- 3rd District ---
  { name: "Calubian", district: "3rd District" },
  { name: "Leyte", district: "3rd District" },
  { name: "San Isidro", district: "3rd District" },
  { name: "Tabango", district: "3rd District" },
  { name: "Villaba", district: "3rd District" },

  // --- 4th District ---
  { name: "Ormoc City", district: "4th District" },
  { name: "Albuera", district: "4th District" },
  { name: "Isabel", district: "4th District" },
  { name: "Kananga", district: "4th District" },
  { name: "Matag-ob", district: "4th District" },
  { name: "Merida", district: "4th District" },
  { name: "Palompon", district: "4th District" },

  // --- 5th District ---
  { name: "Baybay City", district: "5th District" },
  { name: "Abuyog", district: "5th District" },
  { name: "Bato", district: "5th District" },
  { name: "Hilongos", district: "5th District" },
  { name: "Hindang", district: "5th District" },
  { name: "Inopacan", district: "5th District" },
  { name: "Javier", district: "5th District" },
  { name: "Mahaplag", district: "5th District" },
  { name: "Matalom", district: "5th District" },
];
