// src/data/products.ts

export type Product = { id: string; name: string };

export const PRODUCTS: Product[] = [
  { id: "cleanser_gentle", name: "Гель для умывания (мягкий)" },
  { id: "cleanser_soft",   name: "Крем-очищение (деликатное)" },
  { id: "cleanser_oil",    name: "Очищающее масло" },

  { id: "moist_light",     name: "Крем-увлажнитель (лёгкий)" },
  { id: "moist_rich",      name: "Крем-увлажнитель (плотный)" },
  { id: "barrier",         name: "Восстанавливающий барьер" },

  { id: "spf",             name: "SPF 50" },

  // Активы
  { id: "niacinamide",     name: "Ниацинамид 10%" },
  { id: "azelaic",         name: "Азелаиновая кислота 10%" },
  { id: "retinal",         name: "Ретиналь (вечером)" },
];

