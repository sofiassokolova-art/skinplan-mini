// scripts/backfill-risk-score-json.ts
// Backfills safety-critical answer_options.score_json for sensitivity/diagnoses
// and marks Bioderma Sebium products as not suitable for high sensitivity.

import { createScriptPrisma } from './lib/prisma';
import { inferAnswerScore } from '../lib/profile-calculator';

const prisma = createScriptPrisma();
const force = process.argv.includes('--force');
const dryRun = process.argv.includes('--dry-run');

const TARGET_QUESTION_CODES = new Set([
  'skin_sensitivity',
  'medical_diagnoses',
  'diagnoses',
  'sensitivity',
  'SKIN_SENSITIVITY',
  'MEDICAL_DIAGNOSES',
  'DIAGNOSES',
  'SENSITIVITY',
]);

function hasScore(scoreJson: unknown): boolean {
  return !!scoreJson &&
    typeof scoreJson === 'object' &&
    !Array.isArray(scoreJson) &&
    Object.keys(scoreJson).length > 0;
}

async function backfillAnswerScores() {
  const questions = await prisma.question.findMany({
    include: { answerOptions: true },
  });

  let updated = 0;
  let skipped = 0;

  for (const question of questions) {
    if (!TARGET_QUESTION_CODES.has(question.code)) continue;

    for (const option of question.answerOptions) {
      const scoreJson = inferAnswerScore(question.code, option.label);
      if (Object.keys(scoreJson).length === 0) {
        skipped += 1;
        continue;
      }
      if (!force && hasScore(option.scoreJson)) {
        skipped += 1;
        continue;
      }

      if (dryRun) {
        console.log(`[dry-run] answer_option id=${option.id} question=${question.code} label="${option.label}" score=${JSON.stringify(scoreJson)}`);
      } else {
        await prisma.answerOption.update({
          where: { id: option.id },
          data: { scoreJson },
        });
      }
      updated += 1;
    }
  }

  console.log(`answer_options.score_json ${dryRun ? 'would_update' : 'updated'}=${updated}, skipped=${skipped}`);
}

async function backfillSebiumSafetyMarker() {
  const products = await prisma.product.findMany({
    where: {
      brand: { name: { equals: 'Bioderma', mode: 'insensitive' } },
      OR: [
        { name: { contains: 'Sebium', mode: 'insensitive' } },
        { name: { contains: 'Sébium', mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      name: true,
      avoidIf: true,
    },
  });

  let updated = 0;

  for (const product of products) {
    if (product.avoidIf.includes('high_sensitivity')) continue;
    if (dryRun) {
      console.log(`[dry-run] product id=${product.id} name="${product.name}" add avoidIf=high_sensitivity`);
    } else {
      await prisma.product.update({
        where: { id: product.id },
        data: { avoidIf: Array.from(new Set([...product.avoidIf, 'high_sensitivity'])) },
      });
    }
    updated += 1;
  }

  console.log(`Bioderma Sebium products ${dryRun ? 'would_mark' : 'marked'} high_sensitivity=${updated}`);
}

async function main() {
  await backfillAnswerScores();
  await backfillSebiumSafetyMarker();
}

main()
  .catch((error) => {
    console.error('Backfill failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
