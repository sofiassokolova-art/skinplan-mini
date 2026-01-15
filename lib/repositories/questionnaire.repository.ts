// lib/repositories/questionnaire.repository.ts
// Repository для работы с анкетами, вопросами и ответами пользователей
// Инкапсулирует все Prisma запросы для работы с анкетами

import { prisma } from '@/lib/db';
import type { Questionnaire, Question, UserAnswer, QuestionGroup } from '@prisma/client';

export interface QuestionnaireWithRelations extends Questionnaire {
  questionGroups?: Array<QuestionGroup & { questions: Array<Question & { answerOptions: any[] }> }>;
  questions: Array<Question & { answerOptions: any[] }>;
}

export interface UserAnswerWithQuestion extends UserAnswer {
  question: Question & { answerOptions: any[] };
}

/**
 * Repository для работы с анкетами
 */
export class QuestionnaireRepository {
  /**
   * Получить активную анкету
   */
  static async findActive(): Promise<Questionnaire | null> {
    return prisma.questionnaire.findFirst({
      where: { isActive: true },
    });
  }

  /**
   * Получить активную анкету с полными данными (группы, вопросы, опции)
   */
  static async findActiveWithRelations(): Promise<QuestionnaireWithRelations | null> {
    const result = await prisma.questionnaire.findFirst({
      where: { isActive: true },
      include: {
        questionGroups: {
          include: {
            questions: {
              include: {
                answerOptions: true,
              },
            },
          },
        },
        questions: {
          include: {
            answerOptions: true,
          },
        },
      },
    });
    return result as QuestionnaireWithRelations | null;
  }

  /**
   * Получить анкету по ID
   */
  static async findById(id: number): Promise<Questionnaire | null> {
    return prisma.questionnaire.findUnique({
      where: { id },
    });
  }

  /**
   * Получить анкету по ID с полными данными
   */
  static async findByIdWithRelations(id: number): Promise<QuestionnaireWithRelations | null> {
    const result = await prisma.questionnaire.findUnique({
      where: { id },
      include: {
        questionGroups: {
          include: {
            questions: {
              include: {
                answerOptions: true,
              },
            },
          },
        },
        questions: {
          include: {
            answerOptions: true,
          },
        },
      },
    });
    return result as QuestionnaireWithRelations | null;
  }

  /**
   * Получить ID активной анкеты (оптимизированный запрос)
   */
  static async findActiveId(): Promise<{ id: number } | null> {
    return prisma.questionnaire.findFirst({
      where: { isActive: true },
      select: { id: true },
    });
  }
}

/**
 * Repository для работы с ответами пользователей
 */
export class UserAnswerRepository {
  /**
   * Найти ответ пользователя на вопрос
   */
  static async findOne(
    userId: string,
    questionId: number,
    questionnaireId: number
  ): Promise<UserAnswer | null> {
    return prisma.userAnswer.findUnique({
      where: {
        userId_questionnaireId_questionId: {
          userId,
          questionnaireId,
          questionId,
        },
      },
    });
  }

  /**
   * Найти все ответы пользователя для анкеты
   */
  static async findMany(
    userId: string,
    questionnaireId: number
  ): Promise<UserAnswer[]> {
    return prisma.userAnswer.findMany({
      where: {
        userId,
        questionnaireId,
      },
    });
  }

  /**
   * Найти все ответы пользователя для анкеты с вопросами
   */
  static async findManyWithQuestions(
    userId: string,
    questionnaireId: number
  ): Promise<UserAnswerWithQuestion[]> {
    return prisma.userAnswer.findMany({
      where: {
        userId,
        questionnaireId,
      },
      include: {
        question: {
          include: {
            answerOptions: true,
          },
        },
      },
    });
  }

  /**
   * Создать или обновить ответ пользователя (upsert)
   */
  static async upsert(
    userId: string,
    questionId: number,
    questionnaireId: number,
    data: {
      answerValue?: string | null;
      answerValues?: string[];
    }
  ): Promise<UserAnswer> {
    return prisma.userAnswer.upsert({
      where: {
        userId_questionnaireId_questionId: {
          userId,
          questionnaireId,
          questionId,
        },
      },
      update: {
        answerValue: data.answerValue ?? null,
        answerValues: data.answerValues ?? [],
        // updatedAt обновляется автоматически через @updatedAt
      },
      create: {
        userId,
        questionId,
        questionnaireId,
        answerValue: data.answerValue ?? null,
        answerValues: data.answerValues ?? [],
      },
    });
  }

  /**
   * Создать или обновить несколько ответов в транзакции
   */
  static async upsertMany(
    userId: string,
    questionnaireId: number,
    answers: Array<{
      questionId: number;
      answerValue?: string | null;
      answerValues?: string[];
    }>
  ): Promise<UserAnswer[]> {
    return prisma.$transaction(async (tx) => {
      const results: UserAnswer[] = [];
      for (const answer of answers) {
        const result = await tx.userAnswer.upsert({
          where: {
            userId_questionnaireId_questionId: {
              userId,
              questionnaireId,
              questionId: answer.questionId,
            },
          },
          update: {
            answerValue: answer.answerValue ?? null,
            answerValues: answer.answerValues ?? [],
          },
          create: {
            userId,
            questionId: answer.questionId,
            questionnaireId,
            answerValue: answer.answerValue ?? null,
            answerValues: answer.answerValues ?? [],
          },
        });
        results.push(result);
      }
      return results;
    });
  }

  /**
   * Удалить все ответы пользователя для анкеты
   */
  static async deleteMany(
    userId: string,
    questionnaireId: number
  ): Promise<{ count: number }> {
    return prisma.userAnswer.deleteMany({
      where: {
        userId,
        questionnaireId,
      },
    });
  }
}
