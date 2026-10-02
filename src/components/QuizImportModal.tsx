import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, FileText, CheckCircle2, AlertCircle, X, HelpCircle, Copy, ArrowRight, Trash2, Check, RefreshCw } from 'lucide-react';
import { Question } from '../types';
import { parseQuizImport, SAMPLE_QUIZ_FORMAT } from '../lib/quizImportParser';
import { cn } from '../lib/utils';

interface QuizImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (importedQuestions: Question[], appendMode: boolean) => void;
  currentQuestionCount: number;
}

export default function QuizImportModal({
  isOpen,
  onClose,
  onImport,
  currentQuestionCount
}: QuizImportModalProps) {
  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('paste');
  const [inputText, setInputText] = useState(SAMPLE_QUIZ_FORMAT);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedQuestions, setParsedQuestions] = useState<Question[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [appendMode, setAppendMode] = useState<boolean>(currentQuestionCount > 0);
  const [copiedSample, setCopiedSample] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Automatically parse initial sample
  React.useEffect(() => {
    if (isOpen) {
      handleParse(inputText);
    }
  }, [isOpen]);

  const handleParse = (text: string) => {
    const res = parseQuizImport(text);
    setParsedQuestions(res.questions);
    setErrors(res.errors);
    setWarnings(res.warnings);
  };

  const handleFileUpload = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) {
        setInputText(text);
        handleParse(text);
      }
    };
    reader.readAsText(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleSetCorrectAnswer = (questionIndex: number, optionIndex: number) => {
    setParsedQuestions(prev => prev.map((q, idx) => {
      if (idx === questionIndex) {
        return { ...q, correctAnswer: optionIndex.toString() };
      }
      return q;
    }));
  };

  const handleRemoveQuestion = (questionIndex: number) => {
    setParsedQuestions(prev => prev.filter((_, idx) => idx !== questionIndex));
  };

  const handleCopySample = () => {
    navigator.clipboard.writeText(SAMPLE_QUIZ_FORMAT);
    setCopiedSample(true);
    setTimeout(() => setCopiedSample(false), 2000);
  };

  const handleFinalImport = () => {
    if (parsedQuestions.length === 0) return;
    onImport(parsedQuestions, appendMode);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm"
      />

      <motion.div
        initial={{ scale: 0.96, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0, y: 15 }}
        className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col z-10"
      >
        {/* Header */}
        <div className="p-6 md:p-8 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-4 bg-slate-50/60 dark:bg-slate-950/40">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1">
                <Upload className="w-3 h-3 text-indigo-600 dark:text-indigo-400" /> Batch Upload Feature
              </span>
              <span className="text-[10px] font-bold text-slate-400">Summative & Formative Assessments</span>
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Upload Formatted Quiz File
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Import assessment questions with 5-row consecutive format (1 question line followed by 4 choice lines).
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Format Instruction Reference Banner */}
        <div className="px-6 md:px-8 py-3.5 bg-indigo-50/60 dark:bg-indigo-950/20 border-b border-indigo-100/60 dark:border-indigo-900/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 text-indigo-950 dark:text-indigo-200 font-semibold">
            <HelpCircle className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span>
              <strong>5-Row Format:</strong> Row 1: Question • Row 2: Choice A • Row 3: Choice B • Row 4: Choice C • Row 5: Choice D.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopySample}
              className="inline-flex items-center gap-1 px-3 py-1 bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-lg text-[10px] font-black uppercase hover:bg-indigo-50 dark:hover:bg-indigo-950 transition-all shadow-xs"
            >
              {copiedSample ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
              {copiedSample ? 'Copied Template!' : 'Copy Sample'}
            </button>
            <button
              type="button"
              onClick={() => {
                setInputText(SAMPLE_QUIZ_FORMAT);
                handleParse(SAMPLE_QUIZ_FORMAT);
              }}
              className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase hover:bg-indigo-700 transition-all shadow-xs"
            >
              <RefreshCw className="w-3 h-3" />
              Load Sample
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 md:p-8 overflow-y-auto space-y-6 flex-1 divide-y divide-slate-100 dark:divide-slate-800">
          {/* Tab Selector */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('paste')}
              className={cn(
                "px-5 py-2 rounded-xl text-xs font-bold transition-all border",
                activeTab === 'paste'
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
              )}
            >
              Paste Formatted Text
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={cn(
                "px-5 py-2 rounded-xl text-xs font-bold transition-all border",
                activeTab === 'upload'
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
              )}
            >
              Upload Text or CSV File (.txt, .csv)
            </button>
          </div>

          {/* Active Tab Content */}
          <div className="pt-6">
            {activeTab === 'upload' ? (
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-3",
                  isDragOver
                    ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20"
                    : "border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-950/20 hover:border-indigo-400 dark:hover:border-indigo-600"
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.csv,.tsv,.doc,.docx"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Upload className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    {fileName ? `Loaded: ${fileName}` : 'Drag & drop your question file here, or click to browse'}
                  </p>
                  <p className="text-[11px] text-slate-400 font-medium">
                    Supports .txt, .csv, .tsv containing question and choice rows.
                  </p>
                </div>
                {fileName && (
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                    ✓ File Read Successfully
                  </span>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Raw Assessment Text
                  </label>
                  <span className="text-[10px] text-slate-400 italic">
                    Tip: Add * in front of a choice to set it as the correct key (e.g. *Choice A)
                  </span>
                </div>
                <textarea
                  value={inputText}
                  onChange={(e) => {
                    setInputText(e.target.value);
                    handleParse(e.target.value);
                  }}
                  rows={8}
                  placeholder={`Question 1 text...\n*Choice A (marked with *)\nChoice B\nChoice C\nChoice D\n\nQuestion 2 text...\nChoice A\n*Choice B\nChoice C\nChoice D`}
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 p-4 font-mono text-xs text-slate-800 dark:text-slate-200 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-y"
                />
              </div>
            )}
          </div>

          {/* Validation Status & Errors */}
          {(errors.length > 0 || warnings.length > 0) && (
            <div className="pt-6 space-y-2">
              {errors.map((err, i) => (
                <div key={i} className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-xl text-xs font-semibold border border-red-200 dark:border-red-900/50">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{err}</span>
                </div>
              ))}
              {warnings.map((warn, i) => (
                <div key={i} className="flex items-center gap-2 p-2.5 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 rounded-xl text-xs font-medium border border-amber-200 dark:border-amber-900/50">
                  <HelpCircle className="w-4 h-4 shrink-0" />
                  <span>{warn}</span>
                </div>
              ))}
            </div>
          )}

          {/* Parsed Preview Section */}
          <div className="pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Parsed Questions Preview ({parsedQuestions.length})
                </h3>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">
                Click any radio button to adjust the correct answer key
              </span>
            </div>

            {parsedQuestions.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-slate-50 dark:bg-slate-800/20 border border-slate-100 dark:border-slate-800 text-slate-400 text-xs font-medium">
                No questions parsed yet. Paste your assessment content above or upload a text file.
              </div>
            ) : (
              <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1">
                {parsedQuestions.map((q, qIdx) => (
                  <div
                    key={q.id}
                    className="p-5 rounded-2xl bg-slate-50/70 dark:bg-slate-950/40 border border-slate-200/80 dark:border-slate-800/80 space-y-3 relative group"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white text-xs font-black flex items-center justify-center">
                          {qIdx + 1}
                        </span>
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          {q.question}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveQuestion(qIdx)}
                        className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 transition-all opacity-60 group-hover:opacity-100"
                        title="Exclude this question"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Choices Grid */}
                    {q.options && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        {q.options.map((opt, optIdx) => {
                          const isCorrect = q.correctAnswer === optIdx.toString();
                          return (
                            <button
                              key={optIdx}
                              type="button"
                              onClick={() => handleSetCorrectAnswer(qIdx, optIdx)}
                              className={cn(
                                "p-2.5 rounded-xl border text-left text-xs font-medium flex items-center justify-between transition-all",
                                isCorrect
                                  ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 shadow-xs"
                                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700"
                              )}
                            >
                              <div className="flex items-center gap-2.5">
                                <span className={cn(
                                  "w-5 h-5 rounded-md text-[10px] font-black flex items-center justify-center uppercase",
                                  isCorrect ? "bg-emerald-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                                )}>
                                  {String.fromCharCode(65 + optIdx)}
                                </span>
                                <span>{opt}</span>
                              </div>
                              {isCorrect && (
                                <span className="text-[8px] font-black uppercase bg-emerald-600 text-white px-1.5 py-0.5 rounded">
                                  Correct Key
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {currentQuestionCount > 0 && (
              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={appendMode}
                  onChange={(e) => setAppendMode(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span>Append to existing {currentQuestionCount} questions (unchecked will replace)</span>
              </label>
            )}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold text-xs rounded-xl hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleFinalImport}
              disabled={parsedQuestions.length === 0}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2 active:scale-95"
            >
              <span>Import {parsedQuestions.length} Questions</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
