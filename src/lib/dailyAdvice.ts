export type AnalysisSnapshot = {
  skinType: string;
  sensitivity: boolean;
  oiliness: string;
  concerns: string[];
  primaryGoal: string;
  recommendedActives: string[];
  riskFlags: string[];
};

export async function fetchDailyAdvice(analysis: AnalysisSnapshot, abortSignal?: AbortSignal): Promise<string> {
  const response = await fetch("/api/daily-advice", {
    method: "POST",
    signal: abortSignal,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ analysis }),
  });

  if (!response.ok) {
    const errorPayload = await response.text();
    throw new Error(`Advice API error ${response.status}: ${errorPayload}`);
  }

  const data: { advice?: string } = await response.json();

  if (!data.advice) {
    throw new Error("Ответ сервиса не содержит текст совета");
  }

  return data.advice;
}

export const buildAdviceCacheKey = (analysis: AnalysisSnapshot) => {
  const today = new Date().toISOString().slice(0, 10);
  const fingerprint = [
    analysis.skinType,
    analysis.sensitivity ? "sens" : "norm",
    analysis.oiliness,
    analysis.primaryGoal,
    analysis.concerns.join("|"),
  ].join("_");

  return `skiniq.dailyAdvice.${today}.${fingerprint}`;
};

