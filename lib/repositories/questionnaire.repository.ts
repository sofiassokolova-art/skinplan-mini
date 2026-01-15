// lib/repositories/questionnaire.repository.ts
// Repository для работы с анкетами, вопросами и ответами пользователей
// Инкапсулирует все Prisma запросы для работы с анкетами

import { prisma } from '@/lib/db';
import type { Questionnaire, Question, UserAnswer, QuestionGroup } from '@prisma/client';

export interface QuestionnaireWithRelations extends Questionnaire {
  groups: Array<QuestionGroup & { questions: Array<Question & { answerOptions: any[] }> }>;
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
    return prisma.questionnaire.findFirst({
      where: { isActive: true },
      include: {
        groups: {
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
    return prisma.questionnaire.findUnique({
      where: { id },
      include: {
        groups: {
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
        userId_questionId_questionnaireId: {
          userId,
          questionId,
          questionnaireId,
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
        userId_questionId_questionnaireId: {
          userId,
          questionId,
          questionnaireId,
        },
      },
      update: {
        answerValue: data.answerValue ?? null,
        answerValues: data.answerValues ?? [],
        updatedAt: new Date(),
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
    return prisma.$transaction(
      answers.map((answer) =>
        this.upsert(userId, answer.questionId, questionnaireId, {
          answerValue: answer.answerValue,
          answerValues: answer.answerValues,
        })
      )
    );
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
