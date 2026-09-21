export type EvoRyzAIResult = { text:string; structured?:Record<string, unknown> };
/** Future route: app → secure backend → OpenAI. This device-only mock sends nothing anywhere. */
export const EvoRyzAIService = { async ask(prompt:string): Promise<EvoRyzAIResult> { return { text: `Mock EvoRyz AI response for: ${prompt}` }; } };
