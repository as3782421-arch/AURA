import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function getRecommendations(watchedTitles: string[], categories: string[]) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Based on my history: ${watchedTitles.join(', ')}. 
      1. Recommend 4 NEW titles I haven't watched.
      2. Pick 1 title from my list that is worth a REWATCH and explain why.
      Format the response as a JSON array of 5 objects.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              type: { type: Type.STRING },
              reason: { type: Type.STRING },
              highlight: { type: Type.STRING },
              isRewatch: { type: Type.BOOLEAN },
              imageUrl: { type: Type.STRING }
            },
            required: ["title", "type", "reason", "highlight"]
          }
        }
      }
    });

    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("AI Recommendation Error:", error);
    return [];
  }
}

export async function getBrainstorming(title: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Perform a deep dive into "${title}". Focus on character development, hidden themes, and interesting story beats. Format as Markdown.`,
      config: {
        systemInstruction: "You are a media critic and superfan. Provide insightful, slightly academic but passionate analysis."
      }
    });

    return response.text;
  } catch (error) {
    console.error("Brainstorming Error:", error);
    return "Error generating analysis.";
  }
}
