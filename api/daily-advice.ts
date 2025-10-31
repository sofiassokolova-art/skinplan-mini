import type { VercelRequest, VercelResponse } from "@vercel/node";

type AnalysisSnapshot = {
  skinType: string;
  sensitivity: boolean;
  oiliness: string;
  concerns: string[];
  primaryGoal: string;
  recommendedActives: string[];
  riskFlags: string[];
};

const handler = async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
  }

  const parsedBody = typeof req.body === "string" ? safeJson(req.body) : req.body;
  const { analysis } = (parsedBody || {}) as { analysis?: AnalysisSnapshot };

  if (!analysis) {
    return res.status(400).json({ error: "Analysis payload is required" });
  }

  const prompt = buildPrompt(analysis);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.7,
        max_tokens: 220,
        messages: [
          {
            role: "system",
            content:
              "Ты — профессиональный косметолог. Дай практичный совет по уходу за кожей с конкретным действием, временем выполнения и небольшим лайфхаком, учитывая профиль пользователя.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorPayload = await response.text();
      console.error("OpenAI error", response.status, errorPayload);
      return res.status(response.status).json({ error: "OpenAI request failed", details: errorPayload });
    }

    const data: any = await response.json();
    const advice = data?.choices?.[0]?.message?.content?.trim();

    if (!advice) {
      console.error("No advice in OpenAI response", data);
      return res.status(502).json({ error: "OpenAI response malformed" });
    }

    return res.status(200).json({ advice });
  } catch (error) {
    console.error("Advice generation error", error);
    return res.status(500).json({ error: "Failed to generate advice" });
  }
};

const buildPrompt = (analysis: AnalysisSnapshot) => {
  const concerns = analysis.concerns.length
    ? analysis.concerns.join(", ")
    : "нет выраженных проблем";
  const riskFlags = analysis.riskFlags.length ? analysis.riskFlags.join(", ") : "нет";
  const actives = analysis.recommendedActives.join("; ");

  return `Профиль пользователя:
- Тип кожи: ${analysis.skinType}
- Чувствительность: ${analysis.sensitivity ? "повышенная" : "обычная"}
- Жирность: ${analysis.oiliness}
- Основные задачи: ${concerns}
- Главная цель: ${analysis.primaryGoal}
- Рекомендованные активы: ${actives}
- Ограничения: ${riskFlags}

Сформируй один короткий совет (2-3 предложения) с конкретным действием и временем выполнения (утро/вечер/в течение дня). Добавь маленький лайфхак, избегай прямого упоминания ИИ.`;
};

const safeJson = (raw: string) => {
  try {
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
};

export default handler;

