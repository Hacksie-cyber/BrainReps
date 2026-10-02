import { Question, QuestionType } from '../types';

export interface ParsedImportResult {
  questions: Question[];
  errors: string[];
  warnings: string[];
}

/**
 * Strips option prefixes like "A. ", "A) ", "1. ", "1) " and markers like "*", "(correct)"
 */
function cleanOptionText(raw: string): { text: string; isCorrect: boolean } {
  let text = raw.trim();
  let isCorrect = false;

  // Check for leading asterisk, checkmark, or [x]
  if (text.startsWith('*')) {
    isCorrect = true;
    text = text.substring(1).trim();
  } else if (/^\[x\]/i.test(text)) {
    isCorrect = true;
    text = text.replace(/^\[x\]/i, '').trim();
  }

  // Check for trailing (correct), [correct], (key), etc.
  if (/\s*\((correct|key|ans)\)$/i.test(text)) {
    isCorrect = true;
    text = text.replace(/\s*\((correct|key|ans)\)$/i, '').trim();
  } else if (/\s*\[(correct|key|ans)\]$/i.test(text)) {
    isCorrect = true;
    text = text.replace(/\s*\[(correct|key|ans)\]$/i, '').trim();
  }

  // Strip leading letter or number prefixes like "A.", "A)", "1.", "1)"
  text = text.replace(/^[A-Da-d0-9][\.\)\:\-]\s+/, '').trim();

  return { text: text || raw.trim(), isCorrect };
}

/**
 * Strips question prefixes like "1. ", "Q1: ", "Question 1: "
 */
function cleanQuestionText(raw: string): string {
  let text = raw.trim();
  // Strip "1. ", "1) ", "Q1. ", "Q1: ", "Question 1. ", "Question 1: "
  text = text.replace(/^(Q\s*\d+|Question\s*\d+|\d+)[\.\)\:\-]\s+/i, '').trim();
  return text || raw.trim();
}

/**
 * Main parser supporting the 5-row consecutive format:
 * Row 1: Question
 * Row 2: Choice A
 * Row 3: Choice B
 * Row 4: Choice C
 * Row 5: Choice D
 * (and repeat)
 * 
 * Also supports:
 * - Empty line separated blocks
 * - Explicit "Answer: A/B/C/D" or "Answer: text"
 * - Asterisk on correct choice "*Choice A"
 * - CSV with Question, Choice 1, Choice 2, Choice 3, Choice 4, Answer
 */
export function parseQuizImport(content: string): ParsedImportResult {
  const result: ParsedImportResult = {
    questions: [],
    errors: [],
    warnings: []
  };

  const trimmed = content.trim();
  if (!trimmed) {
    result.errors.push('No content provided to parse.');
    return result;
  }

  // 1. Check if input is CSV/TSV format (comma or tab separated with 5+ items per line)
  const rawLines = trimmed.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  const isCSV = rawLines.length > 0 && rawLines.every(l => {
    const parts = l.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
    return parts.length >= 5;
  });

  if (isCSV && rawLines.length > 0) {
    rawLines.forEach((line, lineIdx) => {
      // Ignore header row if it contains "question"
      if (lineIdx === 0 && line.toLowerCase().includes('question') && line.toLowerCase().includes('choice')) {
        return;
      }

      const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.replace(/^"|"$/g, '').trim());
      if (cols.length >= 5) {
        const questionText = cleanQuestionText(cols[0]);
        const options: string[] = [];
        let correctIdx = 0;

        for (let i = 1; i <= 4; i++) {
          const { text, isCorrect } = cleanOptionText(cols[i] || `Option ${i}`);
          options.push(text);
          if (isCorrect) correctIdx = i - 1;
        }

        // Check if column 5 specifies the correct answer
        if (cols[5]) {
          const ansCol = cols[5].trim().toUpperCase();
          if (['A', 'B', 'C', 'D'].includes(ansCol)) {
            correctIdx = ansCol.charCodeAt(0) - 65;
          } else if (['1', '2', '3', '4'].includes(ansCol)) {
            correctIdx = parseInt(ansCol) - 1;
          } else {
            const foundIdx = options.findIndex(o => o.toLowerCase() === cols[5].trim().toLowerCase());
            if (foundIdx !== -1) correctIdx = foundIdx;
          }
        }

        result.questions.push({
          id: crypto.randomUUID(),
          type: 'multiple-choice',
          question: questionText,
          options,
          correctAnswer: correctIdx.toString(),
          points: 1
        });
      }
    });

    if (result.questions.length > 0) {
      return result;
    }
  }

  // 2. Row-by-Row parsing (User's format):
  // Check if text has blank lines separating question blocks
  const blocks = trimmed.split(/\n\s*\n/).map(b => b.trim()).filter(b => b.length > 0);

  if (blocks.length > 1 && blocks.every(b => b.split(/\r?\n/).filter(l => l.trim().length > 0).length >= 3)) {
    // Process block-by-block
    blocks.forEach((block, blockIdx) => {
      const bLines = block.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
      if (bLines.length < 2) return;

      const questionText = cleanQuestionText(bLines[0]);
      const optionLines: string[] = [];
      let explicitAnswer = '';

      for (let i = 1; i < bLines.length; i++) {
        const line = bLines[i];
        if (/^(Answer|Ans|Key|Correct Answer)[\:\s\-]+/i.test(line)) {
          explicitAnswer = line.replace(/^(Answer|Ans|Key|Correct Answer)[\:\s\-]+/i, '').trim();
        } else {
          optionLines.push(line);
        }
      }

      // If 4 options or 2-5 options
      const options: string[] = [];
      let detectedCorrectIdx = -1;

      optionLines.forEach((rawOpt, optIdx) => {
        const { text, isCorrect } = cleanOptionText(rawOpt);
        options.push(text);
        if (isCorrect) detectedCorrectIdx = optIdx;
      });

      // Match explicit answer if provided
      if (explicitAnswer) {
        const upper = explicitAnswer.toUpperCase();
        if (['A', 'B', 'C', 'D'].includes(upper)) {
          detectedCorrectIdx = upper.charCodeAt(0) - 65;
        } else if (['1', '2', '3', '4'].includes(upper)) {
          detectedCorrectIdx = parseInt(upper) - 1;
        } else {
          const matchIdx = options.findIndex(o => o.toLowerCase() === explicitAnswer.toLowerCase());
          if (matchIdx !== -1) detectedCorrectIdx = matchIdx;
        }
      }

      if (detectedCorrectIdx === -1) {
        detectedCorrectIdx = 0;
        result.warnings.push(`Question ${blockIdx + 1}: Defaulted answer key to choice A (${options[0] || 'first option'}).`);
      }

      // Check if it's true/false (2 options: True and False)
      const isTF = options.length === 2 && 
        options.some(o => o.toLowerCase() === 'true') && 
        options.some(o => o.toLowerCase() === 'false');

      if (isTF) {
        const correctVal = options[detectedCorrectIdx]?.toLowerCase() === 'false' ? 'false' : 'true';
        result.questions.push({
          id: crypto.randomUUID(),
          type: 'true-false',
          question: questionText,
          correctAnswer: correctVal,
          points: 1
        });
      } else {
        // Pad to at least 4 options if fewer, or trim to 4
        while (options.length < 4) {
          options.push(`Option ${options.length + 1}`);
        }

        result.questions.push({
          id: crypto.randomUUID(),
          type: 'multiple-choice',
          question: questionText,
          options: options.slice(0, 4),
          correctAnswer: Math.min(detectedCorrectIdx, 3).toString(),
          points: 1
        });
      }
    });

    if (result.questions.length > 0) {
      return result;
    }
  }

  // 3. Strict 5-row consecutive format (no blank lines or continuous stream):
  // Line 0: Question 1
  // Line 1: Option A
  // Line 2: Option B
  // Line 3: Option C
  // Line 4: Option D
  // Line 5: Question 2...
  const allLines = rawLines;
  let i = 0;
  let qNumber = 1;

  while (i < allLines.length) {
    const questionLine = allLines[i];
    if (!questionLine) {
      i++;
      continue;
    }

    const questionText = cleanQuestionText(questionLine);
    const options: string[] = [];
    let detectedCorrectIdx = -1;
    i++;

    // Collect next 4 lines as choices (checking for optional Answer line)
    let collectedOptions = 0;
    while (i < allLines.length && collectedOptions < 4) {
      const line = allLines[i];
      if (/^(Answer|Ans|Key|Correct Answer)[\:\s\-]+/i.test(line)) {
        const rawAns = line.replace(/^(Answer|Ans|Key|Correct Answer)[\:\s\-]+/i, '').trim();
        const upperAns = rawAns.toUpperCase();
        if (['A', 'B', 'C', 'D'].includes(upperAns)) {
          detectedCorrectIdx = upperAns.charCodeAt(0) - 65;
        } else if (['1', '2', '3', '4'].includes(upperAns)) {
          detectedCorrectIdx = parseInt(upperAns) - 1;
        } else {
          const matchIdx = options.findIndex(o => o.toLowerCase() === rawAns.toLowerCase());
          if (matchIdx !== -1) detectedCorrectIdx = matchIdx;
        }
        i++;
        continue;
      }

      const { text, isCorrect } = cleanOptionText(line);
      options.push(text);
      if (isCorrect) detectedCorrectIdx = collectedOptions;
      collectedOptions++;
      i++;
    }

    // Check if subsequent line is an "Answer:" line
    if (i < allLines.length && /^(Answer|Ans|Key|Correct Answer)[\:\s\-]+/i.test(allLines[i])) {
      const rawAns = allLines[i].replace(/^(Answer|Ans|Key|Correct Answer)[\:\s\-]+/i, '').trim();
      const upperAns = rawAns.toUpperCase();
      if (['A', 'B', 'C', 'D'].includes(upperAns)) {
        detectedCorrectIdx = upperAns.charCodeAt(0) - 65;
      } else if (['1', '2', '3', '4'].includes(upperAns)) {
        detectedCorrectIdx = parseInt(upperAns) - 1;
      } else {
        const matchIdx = options.findIndex(o => o.toLowerCase() === rawAns.toLowerCase());
        if (matchIdx !== -1) detectedCorrectIdx = matchIdx;
      }
      i++;
    }

    // Pad to 4 options if fewer found at the end
    while (options.length < 4) {
      options.push(`Option ${options.length + 1}`);
    }

    if (detectedCorrectIdx === -1) {
      detectedCorrectIdx = 0;
      result.warnings.push(`Question ${qNumber}: Defaulted answer key to choice A.`);
    }

    result.questions.push({
      id: crypto.randomUUID(),
      type: 'multiple-choice',
      question: questionText,
      options: options.slice(0, 4),
      correctAnswer: Math.min(detectedCorrectIdx, 3).toString(),
      points: 1
    });

    qNumber++;
  }

  if (result.questions.length === 0) {
    result.errors.push('Could not parse any valid questions. Ensure format is 5 lines per multiple choice question (1 question + 4 choices).');
  }

  return result;
}

export const SAMPLE_QUIZ_FORMAT = `What is the primary function of mitochondria in a cell?
*ATP Energy Production
Protein Synthesis
DNA Storage
Cell Wall Formation

Which gas do plants primarily absorb during photosynthesis?
Oxygen
*Carbon Dioxide
Nitrogen
Argon

What is the capital city of Japan?
*Tokyo
Kyoto
Osaka
Hiroshima

Which organ in the human body produces insulin?
Liver
*Pancreas
Kidney
Stomach`;
