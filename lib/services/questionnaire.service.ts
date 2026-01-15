// lib/services/questionnaire.service.ts
// Сервис для работы с анкетами и ответами
// Вынесена бизнес-логика из API routes

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { createSkinProfile } from '@/lib/profile-calculator';
import type { UserAnswer, Question, Questionnaire } from '@prisma/client';
import { QuestionnaireRepository, UserAnswerRepository } from '@/lib/repositories/questionnaire.repository';

export interface AnswerInput {
  questionId: number;
  answerValue?: string;
  answerValues?: string[];
}

export interface SaveAnswersResult {
  success: boolean;
  savedAnswers?: UserAnswer[];
  profileId?: string;
  error?: string;
}

/**
 * Сервис для работы с анкетами и ответами
 */
export class QuestionnaireService {
  /**
   * Сохранить ответы пользователя и создать/обновить профиль
   */
  static async saveAnswers(
    userId: string,
    questionnaireId: number,
    answers: AnswerInput[],
    existingProfileId?: string | null
  ): Promise<SaveAnswersResult> {
    try {
      // Загружаем анкету через репозиторий
      const questionnaire = await QuestionnaireRepository.findById(questionnaireId);

      if (!questionnaire) {
        return {
          success: false,
          error: 'Questionnaire not found',
        };
      }

      // Сохраняем ответы в транзакции
      const result = await prisma.$transaction(async (tx) => {
        // Сохраняем ответы через транзакцию (используем tx вместо prisma)
        const savedAnswers = await Promise.all(
          answers.map(async (answer) => {
            return tx.userAnswer.upsert({
              where: {
                userId_questionnaireId_questionId: {
                  userId,
                  questionnaireId,
                  questionId: answer.questionId,
                },
              },
              update: {
                answerValue: answer.answerValue || null,
                answerValues: answer.answerValues || [],
                // updatedAt обновляется автоматически через @updatedAt
              },
              create: {
                userId,
                questionId: answer.questionId,
                questionnaireId,
                answerValue: answer.answerValue || null,
                answerValues: answer.answerValues || [],
              },
            });
          })
        );

        // Сохраняем имя пользователя из ответа на вопрос USER_NAME
        const nameAnswer = savedAnswers.find(
          (a) => (a as any).question?.code === 'USER_NAME'
        );
        if (nameAnswer && (nameAnswer as any).answerValue) {
          const userName = String((nameAnswer as any).answerValue).trim();
          if (userName.length > 0) {
            await tx.user.update({
              where: { id: userId },
              data: { firstName: userName },
              select: { id: true },
            });
          }
        }

        // Загружаем полные данные для расчета профиля через транзакцию
        const fullAnswers = await tx.userAnswer.findMany({
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

        // Рассчитываем профиль кожи
        let profileData;
        try {
          profileData = createSkinProfile(
            userId,
            questionnaireId,
            fullAnswers as any,
            questionnaire.version
          );
        } catch (profileCalcError: any) {
          logger.error('Error calculating skin profile', profileCalcError, {
            userId,
            questionnaireId,
            fullAnswersCount: fullAnswers.length,
          });
          throw profileCalcError;
        }

        // Сохраняем или обновляем профиль
        const existingProfile = existingProfileId
          ? await tx.skinProfile.findUnique({
              where: { id: existingProfileId },
            })
          : await tx.skinProfile.findFirst({
              where: { userId },
              orderBy: { createdAt: 'desc' },
            });

        let profile;
        if (existingProfile) {
          const updateData: any = { ...profileData };
          if (updateData.medicalMarkers !== undefined) {
            updateData.medicalMarkers = updateData.medicalMarkers as any; // Prisma JSON type
          }
          profile = await tx.skinProfile.update({
            where: { id: existingProfile.id },
            data: updateData,
          });
        } else {
          const createData: any = { ...profileData, userId };
          if (createData.medicalMarkers !== undefined) {
            createData.medicalMarkers = createData.medicalMarkers as any; // Prisma JSON type
          }
          profile = await tx.skinProfile.create({
            data: createData,
          });
        }

        return {
          savedAnswers,
          profileId: profile.id,
        };
      });

      return {
        success: true,
        savedAnswers: result.savedAnswers,
        profileId: result.profileId,
      };
    } catch (error: any) {
      logger.error('Error saving answers', error, {
        userId,
        questionnaireId,
        answersCount: answers.length,
      });
      return {
        success: false,
        error: error?.message || 'Failed to save answers',
      };
    }
  }

  /**
   * Получить активную анкету
   */
  static async getActiveQuestionnaire(): Promise<Questionnaire | null> {
    try {
      const questionnaire = await QuestionnaireRepository.findActiveWithRelations();
      return questionnaire;
    } catch (error: any) {
      logger.error('Error getting active questionnaire', error);
      return null;
    }
  }
}
