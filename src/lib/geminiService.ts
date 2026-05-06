import { GoogleGenAI } from "@google/genai";

// ✅ No module-level client — lazy init per call to avoid cold-start crashes
let aiInstance: GoogleGenAI | null = null;
let currentApiKey: string | null = null;

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

// ✅ Always returns a valid client or throws a clear error
function getAiClient(): GoogleGenAI {
  const apiKey = process.env.BRAIN_REPS_API_KEY || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "API Key missing. Set BRAIN_REPS_API_KEY in Vercel Dashboard → Settings → Environment Variables, then redeploy."
    );
  }

  // ✅ Re-initialize if key changed (e.g. between hot reloads)
  if (!aiInstance || currentApiKey !== apiKey) {
    aiInstance = new GoogleGenAI({ apiKey });
    currentApiKey = apiKey;
  }

  return aiInstance;
}

export async function askHandoutAssistant(
  query: string,
  sources: ContextSource[],
  history: HandoutMessage[] = []
) {
  // ✅ FIXED: [problem 4] Only pass the last 6 messages of history per request to avoid token bloat
  const trimmedHistory = history.slice(-6);

  // ✅ FIXED: [problem 3] Slice sources to max 3 items and truncate content to 1500 chars
  const trimmedSources = sources.slice(0, 3).map(s => ({
    ...s,
    content: s.content.length > 1500 ? s.content.substring(0, 1500) + "... [truncated]" : s.content
  }));

  // ── Client-side: proxy through backend ──
  if (typeof window !== 'undefined') {
    const response = await fetch('/api/ai/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, sources: trimmedSources, history: trimmedHistory })
    });

    if (!response.ok) {
      let errorMsg = `Neural synchronization failed (${response.status})`;
      let detailedReason = '';

      try {
        const errorData = await response.clone().json();
        errorMsg = errorData.error || errorMsg;
        detailedReason = errorData.details || '';
      } catch {
        const text = await response.text().catch(() => '');
        if (text) detailedReason = text.substring(0, 300);
      }

      const fullError = detailedReason
        ? `${errorMsg} [Detail: ${detailedReason}]`
        : errorMsg;

      console.error("[Neural Client] Sync Error:", fullError);
      throw new Error(fullError);
    }

    const data = await response.json();
    return data.text;
  }

  // ── Server-side: call Gemini directly ──
  const client = getAiClient(); // ✅ Throws clear error if key missing

  // ✅ FIXED: correct model name — gemini-2.5-flash-preview-04-17
  // gemini-2.5-flash does not exist as a standalone ID and causes 404/500
  const modelName = "gemini-2.5-flash-lite";

  const context = trimmedSources.length > 0
    ? trimmedSources.map(s => `[${s.type.toUpperCase()}: ${s.title}]:\n${s.content}`).join('\n\n')
    : "No context sources provided.";

  const systemInstruction = `
You are an AI tutor helping students learn step-by-step.

CONTEXT (Filtered Knowledge Sources):
${context}

STRICT GUIDELINES:
- Be highly concise (1–3 sentences max).
- Only elaborate if the student says “explain in detail” or “elaborate”.
- Use the provided CONTEXT as the primary source of truth.
- If referring to quizzes/handouts, mention them explicitly.
- Use **bold** for key terms. No long intros/outros.

TUTOR RULES:
- Do NOT give full answers immediately.
- Start with a hint or simple explanation.
- Ask a short follow-up question.
- Guide step-by-step; reveal answers only after multiple attempts or if explicitly requested.
- Encourage thinking, not memorization.
  `.trim();

  const contents = [
    ...trimmedHistory.map(m => ({
      role: m.role,
      parts: [{ text: m.content }]
    })),
    {
      role: 'user' as const,
      parts: [{ text: query }]
    }
  ];

  console.log(`[Neural Core] Sending request → model: ${modelName}`);

  // ✅ Retry configuration for high-demand scenarios
  const maxRetries = 3;
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      const response = await client.models.generateContent({
        model: modelName,
        contents,
        config: {
          systemInstruction,
          temperature: 0.7,
        }
      });

      const text = response.text;

      if (!text) {
        console.warn("[Neural Core] Empty response from Gemini.");
        return "I was unable to generate a response. Please try again.";
      }

      return text;

    } catch (error: any) {
      const errorMsg = error.message || String(error);
      const statusCode = error.status || (error.response && error.response.status);
      
      // ✅ FIXED: [problem 2] Expand retry condition to catch 429, 503, and volume/quota/overloaded/rate/exhausted strings
      const isUnavailable = 
        statusCode === 429 || 
        statusCode === 503 || 
        errorMsg.includes("503") || 
        errorMsg.includes("429") ||
        errorMsg.includes("UNAVAILABLE") || 
        errorMsg.includes("high demand") ||
        errorMsg.includes("volume limit") ||
        errorMsg.includes("quota") ||
        errorMsg.includes("overloaded") ||
        errorMsg.includes("rate limit") ||
        errorMsg.includes("RESOURCE_EXHAUSTED");

      if (isUnavailable && attempt < maxRetries) {
        attempt++;
        // ✅ Increased delay for quota recovery "one at a time" approach
        const delay = Math.pow(2, attempt) * 2000; // 4s, 8s, 16s
        console.warn(`[Neural Core] Rate limit / high demand (attempt ${attempt}/${maxRetries}). Waiting ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      console.error("[Neural Core] Generation failed:", { model: modelName, error: errorMsg });

      // ✅ Specific error hints for easier debugging and UX
      if (isUnavailable) {
        if (errorMsg.includes("quota") || errorMsg.includes("exhausted") || statusCode === 429) {
          throw new Error(
            "Neural Quota Exhausted: You have reached the capacity for the Gemini free tier. Please wait about 60 seconds before trying again."
          );
        }
        throw new Error(
          "The neural core is currently under heavy load. Please wait a moment and try your request again."
        );
      }
      if (errorMsg.includes("404") || errorMsg.includes("not found")) {
        throw new Error(
          `Model '${modelName}' not found. Check configurations.`
        );
      }
      if (errorMsg.includes("403") || errorMsg.includes("API_KEY")) {
        throw new Error(
          "Access denied. Please check neural core credentials."
        );
      }
      if (errorMsg.includes("quota") || errorMsg.includes("429")) {
        throw new Error(
          "Message volume limit reached. Please try again in a few minutes."
        );
      }

      throw new Error(`Neural sync failed: ${errorMsg}`);
    }
  }
  
  return "Neural core remains unavailable after retries. Please try again later.";
}