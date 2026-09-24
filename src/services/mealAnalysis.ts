import { EvoRyzAIService } from './evoryzAI';

export interface MealAnalysis {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  portion?: string;
}

export const MealAnalysisService = {
  /**
   * Analyze meal nutrition using backend EvoRyz AI Edge Function or fallback heuristic.
   * Client contains zero API keys or secrets.
   */
  async estimateNutrition(descriptionOrName: string): Promise<MealAnalysis> {
    const trimmed = descriptionOrName.trim();
    if (!trimmed) {
      return {
        name: 'Meal',
        calories: 450,
        protein: 25,
        carbs: 45,
        fat: 15,
        fiber: 5,
        portion: '1 plate',
      };
    }

    try {
      const prompt = `You are a nutrition expert. Estimate the nutritional values for: "${trimmed}".
Respond ONLY with a JSON object in this exact format (no markdown, no extra commentary):
{"name": "${trimmed}", "calories": 450, "protein": 25, "carbs": 50, "fat": 15, "fiber": 6, "portion": "1 serving"}`;

      const aiResponse = await EvoRyzAIService.ask(prompt);
      if (aiResponse.text && !aiResponse.error) {
        const cleaned = aiResponse.text.replace(/```json|```/gi, '').trim();
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            name: typeof parsed.name === 'string' ? parsed.name : trimmed,
            calories: Number(parsed.calories) || 450,
            protein: Number(parsed.protein) || 20,
            carbs: Number(parsed.carbs) || 45,
            fat: Number(parsed.fat) || 15,
            fiber: Number(parsed.fiber) || 5,
            portion: typeof parsed.portion === 'string' ? parsed.portion : '1 serving',
          };
        }
      }
    } catch {
      // Fallback to local heuristic
    }

    // Baseline heuristic estimate based on meal keywords
    const lower = trimmed.toLowerCase();
    let calories = 420;
    let protein = 22;
    let carbs = 48;
    let fat = 14;
    let fiber = 6;
    let portion = '1 serving';

    if (lower.includes('salad') || lower.includes('fruit')) {
      calories = 220; protein = 8; carbs = 32; fat = 7; fiber = 7; portion = '1 bowl';
    } else if (lower.includes('chicken') || lower.includes('steak') || lower.includes('salmon') || lower.includes('fish') || lower.includes('egg') || lower.includes('protein')) {
      calories = 520; protein = 42; carbs = 25; fat = 18; fiber = 4; portion = '250g';
    } else if (lower.includes('pizza') || lower.includes('burger') || lower.includes('pasta')) {
      calories = 680; protein = 26; carbs = 82; fat = 28; fiber = 5; portion = '1 portion';
    } else if (lower.includes('oat') || lower.includes('smoothie') || lower.includes('shake')) {
      calories = 360; protein = 24; carbs = 52; fat = 8; fiber = 8; portion = '1 cup';
    }

    return {
      name: trimmed,
      calories,
      protein,
      carbs,
      fat,
      fiber,
      portion,
    };
  },

  async analyzePhoto(_uri: string, suggestedName?: string): Promise<MealAnalysis> {
    const mealName = suggestedName?.trim() || 'Photo meal';
    return this.estimateNutrition(mealName);
  },
};
