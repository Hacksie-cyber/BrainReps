import { Question, QuizSubmission } from '../types';

export interface EvaluationResult {
  isCorrect: boolean;
  pointsEarned: number;
  maxPoints: number;
  matchedKey?: string;
  feedback?: string;
}

/**
 * Normalizes a text string for robust, fair comparison:
 * - Trims and lowercases
 * - Normalizes unicode characters and diacritics
 * - Removes non-essential punctuation (periods, commas, quotes, etc.) while preserving alphanumeric words
 * - Collapses multiple spaces
 */
export function normalizeAnswerText(text: string | null | undefined): string {
  if (!text) return '';
  return String(text)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .replace(/["'""'’`]/g, '') // remove quotation marks
    .replace(/[.,/#!$%^&*;:{}=\-_~()?[\]]/g, ' ') // replace punctuation with space
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Resolves a given raw representation (index, letter, or text) to an option index (0-based)
 * for multiple choice questions.
 */
export function resolveOptionIndex(
  val: string | number | null | undefined,
  options?: string[]
): number | null {
  if (val === null || val === undefined || !options || options.length === 0) return null;
  const str = String(val).trim();
  if (!str) return null;

  // 1. Check if str is a direct numeric 0-based index: "0", "1", "2"...
  const parsed = parseInt(str, 10);
  if (!isNaN(parsed) && String(parsed) === str) {
    if (parsed >= 0 && parsed < options.length) {
      return parsed;
    }
    // Check 1-based index: e.g. "1" for option 0, "2" for option 1...
    if (parsed >= 1 && parsed <= options.length) {
      return parsed - 1;
    }
  }

  // 2. Check if str is a single letter: "A", "B", "C", "D"... (case-insensitive)
  if (/^[A-Za-z]$/.test(str)) {
    const idx = str.toUpperCase().charCodeAt(0) - 65;
    if (idx >= 0 && idx < options.length) {
      return idx;
    }
  }

  // 3. Check for patterns like "Option A", "Choice A", "(A)", "A.", "1."
  const letterMatch = str.match(/^(?:option|choice)?\s*\(?([A-Za-z])(?:\)|\.|\:)?$/i);
  if (letterMatch) {
    const idx = letterMatch[1].toUpperCase().charCodeAt(0) - 65;
    if (idx >= 0 && idx < options.length) {
      return idx;
    }
  }

  const numberMatch = str.match(/^(?:option|choice)?\s*\(?([0-9]+)(?:\)|\.|\:)?$/i);
  if (numberMatch) {
    const n = parseInt(numberMatch[1], 10);
    // 0-based
    if (n >= 0 && n < options.length) return n;
    // 1-based
    if (n >= 1 && n <= options.length) return n - 1;
  }

  // 4. Exact text match against options (normalized)
  const normStr = normalizeAnswerText(str);
  for (let i = 0; i < options.length; i++) {
    if (normalizeAnswerText(options[i]) === normStr) {
      return i;
    }
  }

  // 5. Raw trim lowercase match (without punctuation removal)
  const rawLower = str.toLowerCase();
  for (let i = 0; i < options.length; i++) {
    if (options[i].trim().toLowerCase() === rawLower) {
      return i;
    }
  }

  // 6. Substring match if high confidence (one contains the other and length is sufficient)
  for (let i = 0; i < options.length; i++) {
    const optNorm = normalizeAnswerText(options[i]);
    if (optNorm.length >= 3 && normStr.length >= 3) {
      if (optNorm === normStr || optNorm.startsWith(normStr) || normStr.startsWith(optNorm)) {
        return i;
      }
    }
  }

  return null;
}

/**
 * Resolves boolean truth for true-false questions
 */
export function resolveBooleanAnswer(val: string | null | undefined): boolean | null {
  if (val === null || val === undefined) return null;
  const str = String(val).trim().toLowerCase();
  if (!str) return null;

  if (['true', 't', 'yes', 'y', '1', 'correct', 'right'].includes(str)) {
    return true;
  }
  if (['false', 'f', 'no', 'n', '0', 'incorrect', 'wrong'].includes(str)) {
    return false;
  }

  // Sometimes Choice A = True, Choice B = False
  if (str === 'a') return true;
  if (str === 'b') return false;

  return null;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}

function isFuzzyMatch(a: string, b: string): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  // Only apply fuzzy matching on terms with at least 5 letters
  if (a.length < 5 || b.length < 5) return false;
  
  const distance = levenshteinDistance(a, b);
  const maxLen = Math.max(a.length, b.length);
  // Allow 1 typo for 5-7 chars, 2 typos for 8+ chars
  const maxAllowed = maxLen >= 8 ? 2 : 1;
  return distance <= maxAllowed;
}

/**
 * Evaluates a student response against a question's answer key according to all official rules
 */
export function evaluateQuestionResponse(
  question: Question,
  rawStudentAnswer: string | null | undefined
): EvaluationResult {
  const maxPoints = Number(question.points) || 1;
  const studentAns = String(rawStudentAnswer ?? '').trim();
  const correctAns = String(question.correctAnswer ?? '').trim();

  // If student didn't answer anything
  if (!studentAns) {
    return {
      isCorrect: false,
      pointsEarned: 0,
      maxPoints,
      feedback: 'No response provided'
    };
  }

  // 1. MULTIPLE CHOICE EVALUATION
  if (question.type === 'multiple-choice') {
    const options = question.options || [];

    // Resolve student's selection to an option index
    const studentIdx = resolveOptionIndex(studentAns, options);

    // Resolve teacher's answer key to an option index
    const correctIdx = resolveOptionIndex(correctAns, options);

    // If both resolve to valid option indices:
    if (studentIdx !== null && correctIdx !== null) {
      const isCorrect = studentIdx === correctIdx;
      return {
        isCorrect,
        pointsEarned: isCorrect ? maxPoints : 0,
        maxPoints,
        matchedKey: options[correctIdx] || String(correctIdx)
      };
    }

    // Direct text comparison if indices couldn't resolve
    const normStudent = normalizeAnswerText(studentAns);
    const normCorrect = normalizeAnswerText(correctAns);
    const isDirectMatch = normStudent !== '' && normStudent === normCorrect;

    // Check if student's answer text matches option pointed to by correctAns if correctAns is a number
    let isOptionTextMatch = false;
    if (!isNaN(parseInt(correctAns, 10)) && options[parseInt(correctAns, 10)]) {
      const optText = normalizeAnswerText(options[parseInt(correctAns, 10)]);
      if (optText === normStudent) {
        isOptionTextMatch = true;
      }
    }

    // Check if correctAns text matches option pointed to by studentAns if studentAns is a number
    if (!isNaN(parseInt(studentAns, 10)) && options[parseInt(studentAns, 10)]) {
      const optText = normalizeAnswerText(options[parseInt(studentAns, 10)]);
      if (optText === normCorrect) {
        isOptionTextMatch = true;
      }
    }

    const isCorrect = isDirectMatch || isOptionTextMatch;
    return {
      isCorrect,
      pointsEarned: isCorrect ? maxPoints : 0,
      maxPoints,
      matchedKey: correctAns
    };
  }

  // 2. TRUE-FALSE EVALUATION
  if (question.type === 'true-false') {
    const studentBool = resolveBooleanAnswer(studentAns);
    const correctBool = resolveBooleanAnswer(correctAns);

    if (studentBool !== null && correctBool !== null) {
      const isCorrect = studentBool === correctBool;
      return {
        isCorrect,
        pointsEarned: isCorrect ? maxPoints : 0,
        maxPoints,
        matchedKey: correctBool ? 'true' : 'false'
      };
    }

    // Fallback direct string comparison
    const isCorrect = studentAns.toLowerCase() === correctAns.toLowerCase();
    return {
      isCorrect,
      pointsEarned: isCorrect ? maxPoints : 0,
      maxPoints,
      matchedKey: correctAns
    };
  }

  // 3. SHORT ANSWER / OPEN-ENDED EVALUATION
  if (question.type === 'short-answer') {
    const normStudent = normalizeAnswerText(studentAns);
    const normFullCorrect = normalizeAnswerText(correctAns);

    // If exact match after normalization
    if (normStudent === normFullCorrect && normStudent.length > 0) {
      return {
        isCorrect: true,
        pointsEarned: maxPoints,
        maxPoints,
        matchedKey: correctAns
      };
    }

    // Split answer key by commas, semicolons, slashes, or pipes into acceptable alternative keys/phrases
    // e.g. "GDP, gross domestic product" -> ["GDP", "gross domestic product"]
    // e.g. "cell wall; cell-wall" -> ["cell wall", "cell-wall"]
    const rawKeys = correctAns
      .split(/[,;/|\n]+/)
      .map(k => k.trim())
      .filter(k => k.length > 0);

    // If teacher provided alternatives (very common: synonyms or alternate spellings):
    // If student matches ANY of these alternatives -> FULL CREDIT!
    let matchedAnyAlternative = false;
    let bestMatchedKey = '';

    for (const key of rawKeys) {
      const normKey = normalizeAnswerText(key);
      if (!normKey) continue;

      // Exact match with one of the alternatives
      if (normStudent === normKey) {
        matchedAnyAlternative = true;
        bestMatchedKey = key;
        break;
      }

      // If student response contains the key as a whole word/phrase
      const wordBoundaryRegex = new RegExp(`(?:^|\\s)${escapeRegex(normKey)}(?:\\s|$)`, 'i');
      if (wordBoundaryRegex.test(normStudent) || normStudent.includes(normKey)) {
        matchedAnyAlternative = true;
        bestMatchedKey = key;
        break;
      }

      // If key contains student response and student response is long enough (e.g. >= 4 chars)
      if (normKey.includes(normStudent) && normStudent.length >= 4) {
        matchedAnyAlternative = true;
        bestMatchedKey = key;
        break;
      }

      // Check Levenshtein distance for typos (tolerance of 1-2 edits)
      if (isFuzzyMatch(normStudent, normKey)) {
        matchedAnyAlternative = true;
        bestMatchedKey = key;
        break;
      }
    }

    if (matchedAnyAlternative) {
      return {
        isCorrect: true,
        pointsEarned: maxPoints,
        maxPoints,
        matchedKey: bestMatchedKey || correctAns
      };
    }

    // Multi-concept questions separated by semicolons (e.g. "biodiversity; ocean warming")
    const conceptParts = correctAns.split(/[;\n]+/).map(k => k.trim()).filter(Boolean);
    if (conceptParts.length > 1) {
      let matchedCount = 0;
      for (const part of conceptParts) {
        const normPart = normalizeAnswerText(part);
        if (normStudent.includes(normPart) || isFuzzyMatch(normStudent, normPart)) {
          matchedCount++;
        }
      }
      if (matchedCount > 0) {
        const fraction = matchedCount / conceptParts.length;
        const points = Math.max(0.5, Math.round(fraction * maxPoints * 10) / 10);
        return {
          isCorrect: matchedCount === conceptParts.length,
          pointsEarned: points,
          maxPoints,
          matchedKey: correctAns,
          feedback: `Matched ${matchedCount} of ${conceptParts.length} key concepts`
        };
      }
    }

    return {
      isCorrect: false,
      pointsEarned: 0,
      maxPoints,
      feedback: 'Response did not match verified answer key'
    };
  }

  // Default fallback
  const isCorrect = studentAns.toLowerCase() === correctAns.toLowerCase();
  return {
    isCorrect,
    pointsEarned: isCorrect ? maxPoints : 0,
    maxPoints
  };
}

/**
 * Grades all questions for a submission and returns clean, rounded metrics
 */
export function gradeSubmission(
  questions: Question[],
  responses: Record<string, string>
): {
  gradedResponses: {
    questionId: string;
    answer: string;
    isCorrect: boolean;
    pointsEarned: number;
    maxPoints: number;
  }[];
  finalScore: number;
  totalPoints: number;
  percentage: number;
} {
  let finalScore = 0;
  let totalPoints = 0;

  const gradedResponses = questions.map(q => {
    const rawAnswer = responses[q.id] || '';
    const result = evaluateQuestionResponse(q, rawAnswer);

    finalScore += result.pointsEarned;
    totalPoints += result.maxPoints;

    return {
      questionId: q.id,
      answer: rawAnswer,
      isCorrect: result.isCorrect,
      pointsEarned: result.pointsEarned,
      maxPoints: result.maxPoints
    };
  });

  finalScore = Math.round(finalScore * 10) / 10;
  totalPoints = Math.round(totalPoints * 10) / 10;
  const percentage = totalPoints > 0 ? Math.round((finalScore / totalPoints) * 100) : 0;

  return {
    gradedResponses,
    finalScore,
    totalPoints,
    percentage
  };
}

/**
 * Takes an existing submission and re-evaluates all questions with the verified answer keys
 */
export function rescoreSubmission(
  questions: Question[],
  submission: QuizSubmission
): {
  submission: QuizSubmission;
  scoreChanged: boolean;
  previousScore: number;
  newScore: number;
} {
  const responsesMap: Record<string, string> = {};
  (submission.responses || []).forEach(r => {
    responsesMap[r.questionId] = r.answer;
  });

  const graded = gradeSubmission(questions, responsesMap);
  const previousScore = submission.score;
  const newScore = graded.finalScore;
  const scoreChanged = previousScore !== newScore;

  return {
    submission: {
      ...submission,
      responses: graded.gradedResponses,
      score: newScore,
      totalPoints: graded.totalPoints,
      graded: true
    },
    scoreChanged,
    previousScore,
    newScore
  };
}
