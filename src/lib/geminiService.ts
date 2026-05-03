import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || '' 
});

export interface HandoutMessage {
  role: 'user' | 'model';
  content: string;
}

export interface ContextSource {
  title: string;
  content: string;
  type: 'handout' | 'quiz';
  subject?: string;
}

export async function askHandoutAssistant(
  query: string,
  sources: ContextSource[],
  history: HandoutMessage[] = []
) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Missing Gemini API Key. Please configure it in the platform settings.");
  }

  const model = "gemini-3-flash-preview";
  
  // Format context from sources
  const context = sources.map(s => `[${s.type.toUpperCase()}: ${s.title}]: ${s.content}`).join('\n');

  const systemInstruction = `
    You are the BrainReps Neural Assistant. 
    
    CONTEXT (Filtered Knowledge Sources):
    ${context}
    
    STRICT GUIDELINES:
    1. Be highly concise. Answer in 1-3 sentences maximum.
    2. Only elaborate if the student explicitly asks to "explain in detail" or "elaborate".
    3. Use the provided CONTEXT as your primary source of truth.
    4. If the question is about specific quiz questions or handouts in the context, refer to them explicitly.
    5. Format: Use bold for key terms. Avoid long intros or outros.
  `;

  const contents = [
    ...history.map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }]
    })),
    {
      role: 'user',
      parts: [{ text: query }]
    }
  ];

  try {
    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction,
        temperature: 0.7,
      }
    });

    return response.text || "I was unable to synchronize with the neural core. Please try again.";
  } catch (error: any) {
    console.error("Gemini Assistant Sync Failure:", error);
    throw error;
  }
}
