// Creates or updates a promo code.
//
// Examples:
// npx tsx scripts/create-promo-code.ts --code=SKIN50 --type=percent --value=50 --products=plan_access
// npx tsx scripts/create-promo-code.ts --code=FREEPLAN --type=override_price --value-kopecks=0 --products=plan_access --max=100
// npx tsx scripts/create-promo-code.ts --code=RENEW99 --type=override_price --value-kopecks=9900 --products=subscription_month --expires=2026-08-31

import { createScriptPrisma } from './lib/prisma';
import { normalizePromoCode, type PromoDiscountType } from '../lib/promo-codes';
import { PAYMENT_PRODUCTS } from '../lib/payment-products';

type Args = Record<string, string | boolean>;

function parseArgs(argv: string[]): Args {
  const args: Args = {};
  for (const arg of argv) {
    if (!arg.startsWith('--')) continue;
    const [rawKey, ...rest] = arg.slice(2).split('=');
    args[rawKey] = rest.length > 0 ? rest.join('=') : true;
  }
  return args;
}

function readString(args: Args, key: string): string | null {
  const value = args[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readInt(args: Args, key: string): number | null {
  const value = readString(args, key);
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function readDate(args: Args, key: string): Date | null {
  const value = readString(args, key);
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid --${key}: ${value}`);
  }
  return parsed;
}

function readProducts(args: Args): string[] {
  const value = readString(args, 'products');
  if (!value) return [];

  const products = value
    .split(',')
    .map((product) => product.trim())
    .filter(Boolean);

  for (const product of products) {
    if (!PAYMENT_PRODUCTS[product]) {
      throw new Error(`Unknown product in --products: ${product}`);
    }
  }

  return products;
}

function readDiscountValue(args: Args, type: PromoDiscountType): number {
  const rawValue = readInt(args, 'value');
  const rawKopecks = readInt(args, 'value-kopecks');

  if (type === 'percent') {
    if (rawValue == null || rawValue < 1 || rawValue > 100) {
      throw new Error('--value must be an integer from 1 to 100 for percent promo codes');
    }
    return rawValue;
  }

  if (rawKopecks == null || rawKopecks < 0) {
    throw new Error('--value-kopecks must be a non-negative integer for fixed and override_price promo codes');
  }

  return rawKopecks;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const code = normalizePromoCode(readString(args, 'code') ?? '');
  const type = readString(args, 'type') as PromoDiscountType | null;

  if (!code) {
    throw new Error('--code is required');
  }

  if (type !== 'percent' && type !== 'fixed' && type !== 'override_price') {
    throw new Error('--type must be one of: percent, fixed, override_price');
  }

  const discountValue = readDiscountValue(args, type);
  const maxRedemptions = readInt(args, 'max');
  const maxRedemptionsPerUser = readInt(args, 'per-user') ?? 1;
  const active = args.active === undefined ? true : args.active !== 'false';
  const products = readProducts(args);
  const startsAt = readDate(args, 'starts');
  const expiresAt = readDate(args, 'expires');
  const description = readString(args, 'description');

  if (maxRedemptions != null && maxRedemptions < 1) {
    throw new Error('--max must be a positive integer');
  }

  if (maxRedemptionsPerUser < 1) {
    throw new Error('--per-user must be a positive integer');
  }

  const prisma = createScriptPrisma();
  try {
    const promo = await prisma.promoCode.upsert({
      where: { code },
      update: {
        description,
        active,
        discountType: type,
        discountValue,
        appliesToProductCodes: { set: products },
        maxRedemptions,
        maxRedemptionsPerUser,
        startsAt,
        expiresAt,
      },
      create: {
        code,
        description,
        active,
        discountType: type,
        discountValue,
        appliesToProductCodes: products,
        maxRedemptions,
        maxRedemptionsPerUser,
        startsAt,
        expiresAt,
      },
    });

    console.log('Promo code saved');
    console.log({
      id: promo.id,
      code: promo.code,
      active: promo.active,
      discountType: promo.discountType,
      discountValue: promo.discountValue,
      appliesToProductCodes: promo.appliesToProductCodes,
      maxRedemptions: promo.maxRedemptions,
      maxRedemptionsPerUser: promo.maxRedemptionsPerUser,
      startsAt: promo.startsAt,
      expiresAt: promo.expiresAt,
    });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

