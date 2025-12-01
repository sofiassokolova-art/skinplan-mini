// lib/skinprofile-types.ts
// Расширенный тип SkinProfile для JSON-правил

export type SkinProfile = {
  skinType: "dry" | "combination_dry" | "normal" | "combination_oily" | "oily" | null;
  sensitivity: "low" | "medium" | "high" | "very_high" | null;
  mainGoals: string[];
  secondaryGoals: string[];
  diagnoses: string[];
  seasonality: "summer_oilier" | "winter_drier" | "stable" | null;
  pregnancyStatus: "pregnant" | "breastfeeding" | "none" | null;
  contraindications: string[];
  currentTopicals: string[];
  currentOralMeds: string[];
  spfHabit: "daily" | "sometimes" | "never";
  makeupFrequency: "daily" | "sometimes" | "rarely";
  lifestyleFactors: string[];
  carePreference: "mass" | "natural" | "dermo" | "any";
  routineComplexity: "minimal" | "medium" | "maximal" | "any";
  budgetSegment: "budget" | "medium" | "premium" | "any";
  ageGroup?: "u18" | "18_24" | "25_34" | "35_44" | "45plus";
  gender?: "female" | "male";
};

export function createEmptySkinProfile(): SkinProfile {
  return {
    skinType: null,
    sensitivity: null,
    mainGoals: [],
    secondaryGoals: [],
    diagnoses: [],
    seasonality: null,
    pregnancyStatus: "none",
    contraindications: [],
    currentTopicals: [],
    currentOralMeds: [],
    spfHabit: "never",
    makeupFrequency: "rarely",
    lifestyleFactors: [],
    carePreference: "any",
    routineComplexity: "any",
    budgetSegment: "any",
  };
}

