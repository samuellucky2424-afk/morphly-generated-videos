import { env } from '@/src/lib/env';

export async function enhanceVideoPrompt(originalPrompt: string): Promise<string> {
  const apiKey = env.GEMINI_KEY;
  if (!apiKey) {
    return originalPrompt;
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `You are an expert prompt engineer for the LTX 2.3 video generation model. 
Your task is to enhance the user's video prompt to ensure accurate results, specifically focusing on maintaining character consistency and vivid descriptive details.
Do not change the core subject or action. Add necessary cinematic, lighting, and consistency details.
Respond with ONLY the enhanced prompt text, nothing else.

User Prompt: ${originalPrompt}`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 250,
          },
        }),
      },
    );

    if (!response.ok) {
      console.warn('Gemini enhancement failed with status:', response.status);
      return originalPrompt;
    }

    const data = await response.json();
    const enhanced = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (enhanced && typeof enhanced === 'string') {
      return enhanced.trim();
    }

    return originalPrompt;
  } catch (error) {
    console.error('Error calling Gemini API for prompt enhancement:', error);
    return originalPrompt;
  }
}
