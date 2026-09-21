export type MealAnalysis = { name:string; calories:number; protein:number; carbs:number; fat:number; fiber:number };
/** Replace this local mock with a backend call; never place an AI key in the client. */
export const MealAnalysisService = { async analyzePhoto(_uri:string): Promise<MealAnalysis> { return { name: 'Photo meal', calories: 420, protein: 24, carbs: 48, fat: 16, fiber: 7 }; } };
