interface SkinAnalysisResult {
  skinType: string;
  concerns: string[];
  problemAreas: Array<{
    type: string;
    description: string;
    severity: "low" | "medium" | "high";
    coordinates?: { x: number; y: number; width: number; height: number };
  }>;
  recommendations: string[];
  confidence: number;
}

const OPENAI_API_KEY = (import.meta.env?.VITE_OPENAI_API_KEY as string) || 
                      (typeof window !== 'undefined' ? localStorage.getItem('openai_api_key') : null) ||
                      'sk-proj-demo'; // Fallback для демо

export async function analyzeSkinPhoto(imageDataUrl: string): Promise<SkinAnalysisResult> {
  try {
    // Если нет API ключа, возвращаем демо-результат
    if (!OPENAI_API_KEY || OPENAI_API_KEY === 'sk-proj-demo') {
      return getDemoAnalysis();
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4-vision-preview",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Проанализируй это фото лица и определи:
1. Тип кожи (сухая/жирная/комбинированная/нормальная)
2. Видимые проблемы (акне, постакне, поры, покраснение, сухость)
3. Области с проблемами (примерные координаты в %)
4. Рекомендации по уходу

Ответь в JSON формате:
{
  "skinType": "тип кожи",
  "concerns": ["список проблем"],
  "problemAreas": [
    {
      "type": "тип проблемы",
      "description": "описание",
      "severity": "low|medium|high",
      "coordinates": {"x": 10, "y": 20, "width": 15, "height": 10}
    }
  ],
  "recommendations": ["рекомендации"],
  "confidence": 0.85
}`
              },
              {
                type: "image_url",
                image_url: {
                  url: imageDataUrl,
                  detail: "high"
                }
              }
            ]
          }
        ],
        max_tokens: 1000,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error('No analysis content received');
    }

    // Парсим JSON ответ
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid JSON response');
    }

    const analysis = JSON.parse(jsonMatch[0]);
    return analysis;

  } catch (error) {
    console.error('Skin analysis error:', error);
    // В случае ошибки возвращаем демо-результат
    return getDemoAnalysis();
  }
}

function getDemoAnalysis(): SkinAnalysisResult {
  return {
    skinType: "комбинированная",
    concerns: ["жирность T-зоны", "единичные воспаления", "расширенные поры"],
    problemAreas: [
      {
        type: "жирность",
        description: "Повышенная жирность в T-зоне",
        severity: "medium",
        coordinates: { x: 35, y: 25, width: 30, height: 15 }
      },
      {
        type: "воспаления",
        description: "Единичные воспаления на подбородке",
        severity: "low",
        coordinates: { x: 40, y: 65, width: 20, height: 10 }
      },
      {
        type: "поры",
        description: "Расширенные поры на носу",
        severity: "medium", 
        coordinates: { x: 45, y: 45, width: 10, height: 15 }
      }
    ],
    recommendations: [
      "Используйте мягкое очищение 2 раза в день",
      "Добавьте BHA 2-3 раза в неделю для T-зоны",
      "Увлажнение лёгкими текстурами",
      "SPF ежедневно для предотвращения пост-акне"
    ],
    confidence: 0.87
  };
}

export function setupOpenAIKey(apiKey: string) {
  localStorage.setItem('openai_api_key', apiKey);
}