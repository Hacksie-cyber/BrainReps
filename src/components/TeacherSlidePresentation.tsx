import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { Quiz, Question } from '../types';
import { motion, AnimatePresence, Variants } from 'motion/react';
import { 
  ArrowLeft, 
  Maximize2, 
  Minimize2, 
  Grid, 
  X, 
  Type, 
  Keyboard, 
  Sparkles,
  Layers,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Play,
  Pause,
  RotateCcw,
  Eye,
  EyeOff,
  Printer,
  Key,
  Tv,
  Presentation,
  ShieldCheck,
  FileText,
  AlertCircle,
  Edit3,
  ListFilter,
  CheckCircle2,
  HelpCircle,
  LayoutGrid,
  Rows
} from 'lucide-react';
import { cn } from '../lib/utils';

export default function TeacherSlidePresentation() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Presentation State
  const [currentIndex, setCurrentIndex] = useState(0);
  const [slideDirection, setSlideDirection] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fontSize, setFontSize] = useState<'standard' | 'large' | 'jumbo' | 'ultra'>('large');
  const [showAnswerKey, setShowAnswerKey] = useState(false);
  const [isBlackout, setIsBlackout] = useState(false);
  const [showGridDrawer, setShowGridDrawer] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>('dark');
  const [classroomBanner, setClassroomBanner] = useState('📝 Write your final answer for each question on your physical paper test sheet.');
  const [isEditingBanner, setIsEditingBanner] = useState(false);

  // Answer Key Summary Slide State
  const [summaryViewMode, setSummaryViewMode] = useState<'grid' | 'table'>('grid');
  const [revealedQuestions, setRevealedQuestions] = useState<Record<string, boolean>>({});
  const [allSummaryRevealed, setAllSummaryRevealed] = useState(true);

  // Timer State
  const [timerDuration, setTimerDuration] = useState<number>(60); // seconds per question default
  const [timerRemaining, setTimerRemaining] = useState<number>(60);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch Quiz
  useEffect(() => {
    if (!id) return;
    const fetchQuiz = async () => {
      try {
        setLoading(true);
        const docRef = doc(db, 'quizzes', id);
        const snap = await getDoc(docRef);
        if (!snap.exists()) {
          setError("Assessment module not found.");
          return;
        }
        const data = { id: snap.id, ...snap.data() } as Quiz;
        setQuiz(data);
        if (data.timeLimit && data.timeLimit > 0) {
          // If total time limit is set, default question timer to reasonable fraction
          const approxPerQuestion = Math.max(30, Math.floor((data.timeLimit * 60) / (data.questions.length || 1)));
          setTimerDuration(approxPerQuestion);
          setTimerRemaining(approxPerQuestion);
        }

        // Initialize revealed questions state to all true by default
        const initialRevealed: Record<string, boolean> = {};
        data.questions.forEach(q => {
          initialRevealed[q.id] = true;
        });
        setRevealedQuestions(initialRevealed);
      } catch (err: any) {
        console.error("Failed to load quiz for presentation:", err);
        setError("Failed to load assessment. Please verify permissions.");
      } finally {
        setLoading(false);
      }
    };
    fetchQuiz();
  }, [id]);

  // Listen for fullscreen change
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Timer interval
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isTimerRunning && timerRemaining > 0) {
      interval = setInterval(() => {
        setTimerRemaining(prev => {
          if (prev <= 1) {
            setIsTimerRunning(false);
            if (soundEnabled) {
              try {
                const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
                gain.gain.setValueAtTime(0.15, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start();
                osc.stop(ctx.currentTime + 0.5);
              } catch (e) {
                // Audio context not allowed or supported
              }
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning, timerRemaining, soundEnabled]);

  // Reset timer on question change
  const handleQuestionChange = (newIndex: number, direction: number) => {
    setSlideDirection(direction);
    setCurrentIndex(newIndex);
    setTimerRemaining(timerDuration);
  };

  const totalQuestions = quiz ? quiz.questions.length : 0;
  const totalSlides = totalQuestions + 1; // Last slide is the Answer Key Summary
  const isSummarySlide = currentIndex === totalQuestions;

  const handleNext = () => {
    if (!quiz) return;
    if (currentIndex < totalSlides - 1) {
      handleQuestionChange(currentIndex + 1, 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      handleQuestionChange(currentIndex - 1, -1);
    }
  };

  const toggleFullscreen = () => {
    try {
      if (!document.fullscreenElement) {
        containerRef.current?.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    } catch (e) {
      console.warn("Fullscreen API not available:", e);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') return;

      if (e.key === 'ArrowRight' || e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey)) {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp' || (e.key === ' ' && e.shiftKey)) {
        e.preventDefault();
        handlePrev();
      } else if (e.key.toLowerCase() === 'f' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key.toLowerCase() === 'b' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setIsBlackout(prev => !prev);
      } else if (e.key.toLowerCase() === 'k' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setShowAnswerKey(prev => !prev);
      } else if (e.key.toLowerCase() === 'g' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setShowGridDrawer(prev => !prev);
      } else if (e.key.toLowerCase() === 't' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setIsTimerRunning(prev => !prev);
      } else if (e.key.toLowerCase() === '?' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setShowShortcutsModal(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePrintTest = () => {
    window.print();
  };

  // Helper function to resolve question answer label and detail
  const getAnswerDetail = (q: Question) => {
    if (q.type === 'multiple-choice' && q.options && q.options.length > 0) {
      const matchIdx = q.options.findIndex((opt, idx) => {
        const letter = String.fromCharCode(65 + idx);
        return (
          opt.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase() ||
          letter.toLowerCase() === q.correctAnswer.trim().toLowerCase() ||
          String(idx) === q.correctAnswer.trim()
        );
      });

      if (matchIdx !== -1) {
        const letter = String.fromCharCode(65 + matchIdx);
        return {
          letter,
          text: q.options[matchIdx],
          display: `${letter}. ${q.options[matchIdx]}`
        };
      }
    }

    if (q.type === 'true-false') {
      const isTrue = q.correctAnswer.trim().toLowerCase() === 'true';
      return {
        letter: isTrue ? 'T' : 'F',
        text: isTrue ? 'True' : 'False',
        display: isTrue ? 'True' : 'False'
      };
    }

    return {
      letter: '•',
      text: q.correctAnswer,
      display: q.correctAnswer
    };
  };

  const toggleRevealSingle = (qId: string) => {
    setRevealedQuestions(prev => ({
      ...prev,
      [qId]: !prev[qId]
    }));
  };

  const toggleAllSummaryReveal = () => {
    if (!quiz) return;
    const nextState = !allSummaryRevealed;
    setAllSummaryRevealed(nextState);
    const newRevealed: Record<string, boolean> = {};
    quiz.questions.forEach(q => {
      newRevealed[q.id] = nextState;
    });
    setRevealedQuestions(newRevealed);
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Loading Classroom Presentation...</p>
        </div>
      </div>
    );
  }

  if (error || !quiz) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-slate-950 p-6 text-white text-center">
        <div className="w-16 h-16 bg-red-900/30 rounded-2xl flex items-center justify-center border border-red-800/50 mb-4">
          <AlertCircle className="w-8 h-8 text-red-400" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Classroom Projector Unavailable</h2>
        <p className="text-slate-400 text-sm max-w-md mb-6">{error || "The requested assessment could not be loaded."}</p>
        <button
          onClick={() => navigate('/teacher/assessments')}
          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all shadow-lg"
        >
          Return to Assessments
        </button>
      </div>
    );
  }

  const currentQuestion: Question | undefined = isSummarySlide ? undefined : quiz.questions[currentIndex];
  const progressPercent = ((currentIndex + 1) / totalSlides) * 100;
  const totalQuizPoints = quiz.questions.reduce((sum, q) => sum + (q.points || 1), 0);

  // Slide Animation Variants
  const slideVariants: Variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 250 : -250,
      opacity: 0,
      scale: 0.98
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
      transition: {
        x: { type: "spring", stiffness: 350, damping: 30 },
        opacity: { duration: 0.25 }
      }
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 250 : -250,
      opacity: 0,
      scale: 0.98,
      transition: {
        x: { type: "spring", stiffness: 350, damping: 30 },
        opacity: { duration: 0.2 }
      }
    })
  };

  const getQuestionFontSize = () => {
    switch (fontSize) {
      case 'standard': return 'text-xl sm:text-2xl lg:text-3xl leading-relaxed';
      case 'large': return 'text-2xl sm:text-3xl lg:text-4xl leading-relaxed font-semibold';
      case 'jumbo': return 'text-3xl sm:text-4xl lg:text-5xl leading-tight font-bold';
      case 'ultra': return 'text-4xl sm:text-5xl lg:text-6xl leading-tight font-black';
    }
  };

  const getOptionFontSize = () => {
    switch (fontSize) {
      case 'standard': return 'text-base sm:text-lg';
      case 'large': return 'text-lg sm:text-xl font-medium';
      case 'jumbo': return 'text-xl sm:text-2xl font-semibold';
      case 'ultra': return 'text-2xl sm:text-3xl font-bold';
    }
  };

  return (
    <div 
      ref={containerRef}
      className={cn(
        "min-h-screen w-full flex flex-col select-none transition-colors duration-300 relative overflow-x-hidden font-sans",
        themeMode === 'dark' ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900"
      )}
    >
      {/* Top Classroom HUD Bar */}
      <header className={cn(
        "w-full px-4 sm:px-8 py-3.5 border-b flex items-center justify-between gap-4 z-40 transition-colors backdrop-blur-md sticky top-0",
        themeMode === 'dark' 
          ? "bg-slate-950/90 border-slate-800/80 text-slate-200" 
          : "bg-white/95 border-slate-200 text-slate-800 shadow-sm"
      )}>
        {/* Left: Exit & Quiz Info */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate('/teacher/assessments')}
            className={cn(
              "p-2 rounded-xl border transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wider shrink-0",
              themeMode === 'dark'
                ? "bg-slate-900 border-slate-800 hover:bg-slate-800 text-slate-300"
                : "bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-700"
            )}
            title="Exit Presentation"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden md:inline">Exit</span>
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
              <Presentation className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-bold truncate tracking-tight">{quiz.title}</h1>
              <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 flex items-center gap-1.5">
                <span>Classroom Projector</span>
                <span className="w-1 h-1 rounded-full bg-slate-500" />
                <span>Paper Exam</span>
              </p>
            </div>
          </div>
        </div>

        {/* Center: Slide Progress Pill */}
        <div className="hidden lg:flex items-center gap-3">
          <div className={cn(
            "flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-bold tracking-wider",
            isSummarySlide
              ? "bg-emerald-950/60 border-emerald-500/50 text-emerald-300 shadow-sm"
              : themeMode === 'dark'
                ? "bg-slate-900/80 border-slate-800 text-slate-300"
                : "bg-slate-100 border-slate-200 text-slate-700"
          )}>
            {isSummarySlide ? (
              <>
                <Key className="w-3.5 h-3.5 text-emerald-400" />
                <span>End of Slide: Answer Key Summary</span>
              </>
            ) : (
              <>
                <Layers className="w-3.5 h-3.5 text-indigo-500" />
                <span>Question {currentIndex + 1} of {totalQuestions}</span>
                <span className="text-[10px] text-slate-500">({Math.round(progressPercent)}%)</span>
              </>
            )}
          </div>

          {/* Quick Question Timer Widget (only on question slides) */}
          {!isSummarySlide && (
            <div className={cn(
              "flex items-center gap-2 px-3 py-1 rounded-xl border text-xs font-mono font-bold transition-all",
              timerRemaining <= 10 && isTimerRunning
                ? "bg-red-950/40 border-red-800 text-red-400 animate-pulse"
                : themeMode === 'dark'
                  ? "bg-slate-900 border-slate-800 text-indigo-300"
                  : "bg-indigo-50 border-indigo-200 text-indigo-700"
            )}>
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              <span>{formatTime(timerRemaining)}</span>
              <button
                onClick={() => setIsTimerRunning(prev => !prev)}
                className="p-1 hover:bg-white/10 rounded transition-all"
                title={isTimerRunning ? "Pause Timer (T)" : "Start Timer (T)"}
              >
                {isTimerRunning ? <Pause className="w-3 h-3 text-amber-400" /> : <Play className="w-3 h-3 text-emerald-400" />}
              </button>
              <button
                onClick={() => setTimerRemaining(timerDuration)}
                className="p-1 hover:bg-white/10 rounded transition-all text-slate-400 hover:text-slate-200"
                title="Reset Timer to Duration"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Right: Teacher Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Jump directly to Answer Key Summary */}
          <button
            onClick={() => handleQuestionChange(totalQuestions, 1)}
            className={cn(
              "px-3 py-1.5 rounded-xl border font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-sm",
              isSummarySlide
                ? "bg-emerald-600 border-emerald-500 text-white shadow-emerald-900/30 ring-2 ring-emerald-500/30"
                : "bg-emerald-950/30 border-emerald-800/50 text-emerald-400 hover:bg-emerald-900/40"
            )}
            title="Jump to Master Answer Key Summary Slide"
          >
            <Key className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Answer Key</span>
          </button>

          {/* Answer Key Toggle on single question slide */}
          {!isSummarySlide && (
            <button
              onClick={() => setShowAnswerKey(prev => !prev)}
              className={cn(
                "px-3 py-1.5 rounded-xl border font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-sm",
                showAnswerKey
                  ? "bg-indigo-600 border-indigo-500 text-white shadow-indigo-900/30"
                  : themeMode === 'dark'
                    ? "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
                    : "bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900"
              )}
              title="Toggle Live Answer Key on Current Question (Shortcut: K)"
            >
              {showAnswerKey ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{showAnswerKey ? "Key On" : "Key Off"}</span>
            </button>
          )}

          {/* Blackout / Attention Mode */}
          <button
            onClick={() => setIsBlackout(prev => !prev)}
            className={cn(
              "p-2 rounded-xl border transition-all shadow-sm",
              isBlackout
                ? "bg-amber-600 border-amber-500 text-white"
                : themeMode === 'dark'
                  ? "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                  : "bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900"
            )}
            title="Classroom Intermission / Blackout Screen (Shortcut: B)"
          >
            <Tv className="w-4 h-4" />
          </button>

          {/* Font Size Selector */}
          <div className="relative group">
            <button
              className={cn(
                "p-2 rounded-xl border transition-all",
                themeMode === 'dark'
                  ? "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                  : "bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900"
              )}
              title="Adjust Text Size for Projector"
            >
              <Type className="w-4 h-4" />
            </button>
            <div className={cn(
              "absolute right-0 top-full mt-2 hidden group-hover:flex flex-col p-1.5 rounded-xl border shadow-2xl z-50 min-w-[130px]",
              themeMode === 'dark' ? "bg-slate-900 border-slate-800 text-slate-200" : "bg-white border-slate-200 text-slate-800"
            )}>
              {(['standard', 'large', 'jumbo', 'ultra'] as const).map(size => (
                <button
                  key={size}
                  onClick={() => setFontSize(size)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-left text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-between",
                    fontSize === size 
                      ? "bg-indigo-600 text-white" 
                      : themeMode === 'dark' ? "hover:bg-slate-800 text-slate-400 hover:text-slate-200" : "hover:bg-slate-100 text-slate-600"
                  )}
                >
                  <span>{size}</span>
                  {fontSize === size && <Check className="w-3 h-3" />}
                </button>
              ))}
            </div>
          </div>

          {/* Question Grid Thumbnail Drawer */}
          <button
            onClick={() => setShowGridDrawer(true)}
            className={cn(
              "p-2 rounded-xl border transition-all",
              themeMode === 'dark'
                ? "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                : "bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900"
            )}
            title="Question Grid / Jump to Slide (Shortcut: G)"
          >
            <Grid className="w-4 h-4" />
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className={cn(
              "p-2 rounded-xl border transition-all",
              themeMode === 'dark'
                ? "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                : "bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900"
            )}
            title={isFullscreen ? "Exit Fullscreen (F)" : "Enter Fullscreen (F)"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Shortcuts Help */}
          <button
            onClick={() => setShowShortcutsModal(true)}
            className={cn(
              "p-2 rounded-xl border transition-all",
              themeMode === 'dark'
                ? "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                : "bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900"
            )}
            title="Keyboard Shortcuts (?)"
          >
            <Keyboard className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Classroom Announcement Banner */}
      <div className={cn(
        "w-full px-4 sm:px-8 py-2 border-b text-xs flex items-center justify-between gap-4 transition-colors",
        themeMode === 'dark' 
          ? "bg-indigo-950/40 border-indigo-900/30 text-indigo-200" 
          : "bg-indigo-50 border-indigo-100 text-indigo-900"
      )}>
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0" />
          {isEditingBanner ? (
            <input
              type="text"
              value={classroomBanner}
              onChange={(e) => setClassroomBanner(e.target.value)}
              onBlur={() => setIsEditingBanner(false)}
              onKeyDown={(e) => e.key === 'Enter' && setIsEditingBanner(false)}
              autoFocus
              className="flex-1 bg-white/10 px-2 py-0.5 rounded border border-indigo-400/30 text-xs text-white focus:outline-none"
            />
          ) : (
            <p className="font-semibold truncate cursor-pointer hover:underline" onClick={() => setIsEditingBanner(true)}>
              {classroomBanner}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setIsEditingBanner(prev => !prev)}
            className="text-[10px] font-bold uppercase tracking-wider opacity-70 hover:opacity-100 flex items-center gap-1"
          >
            <Edit3 className="w-3 h-3" />
            <span>Edit Note</span>
          </button>
          <span className="opacity-30">•</span>
          <button
            onClick={() => setThemeMode(prev => prev === 'dark' ? 'light' : 'dark')}
            className="text-[10px] font-bold uppercase tracking-wider opacity-70 hover:opacity-100"
          >
            {themeMode === 'dark' ? 'Light Canvas' : 'Dark Canvas'}
          </button>
        </div>
      </div>

      {/* Main Slide Canvas */}
      <main className="flex-1 flex flex-col justify-center px-4 sm:px-12 lg:px-20 py-8 max-w-7xl mx-auto w-full relative">
        <AnimatePresence mode="wait" custom={slideDirection}>
          {isBlackout ? (
            /* Blackout / Classroom Intermission Screen */
            <motion.div
              key="blackout-screen"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center justify-center text-center py-20 px-6 space-y-6"
            >
              <div className="w-20 h-20 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Tv className="w-10 h-10" />
              </div>
              <div className="space-y-2 max-w-lg">
                <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-amber-400">Eyes Up Front</h2>
                <p className="text-sm sm:text-base text-slate-400 font-medium leading-relaxed">
                  Assessment projection is temporarily paused. Please direct your attention to the teacher's instructions.
                </p>
              </div>
              <button
                onClick={() => setIsBlackout(false)}
                className="px-8 py-3.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-xl shadow-amber-500/20 active:scale-95 flex items-center gap-2"
              >
                <Play className="w-4 h-4 fill-current" />
                Resume Slide Display (B)
              </button>
            </motion.div>
          ) : isSummarySlide ? (
            /* END OF SLIDE: MASTER ANSWER KEY SUMMARY */
            <motion.div
              key="summary-answers-slide"
              custom={slideDirection}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="w-full space-y-6"
            >
              {/* Answer Key Header */}
              <div className={cn(
                "p-6 sm:p-8 rounded-3xl border flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl",
                themeMode === 'dark' 
                  ? "bg-slate-900/80 border-emerald-500/30 shadow-black/40" 
                  : "bg-white border-emerald-200 shadow-slate-200/50"
              )}>
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="px-3.5 py-1 rounded-xl bg-emerald-600 text-white font-black text-xs sm:text-sm uppercase tracking-widest flex items-center gap-1.5 shadow-md shadow-emerald-600/30">
                      <Key className="w-4 h-4" />
                      <span>Answer Key Summary</span>
                    </span>
                    <span className={cn(
                      "px-3 py-1 rounded-xl border font-bold text-xs uppercase tracking-wider",
                      themeMode === 'dark' ? "bg-slate-950 border-slate-800 text-slate-300" : "bg-slate-100 border-slate-200 text-slate-700"
                    )}>
                      {totalQuestions} Questions • {totalQuizPoints} Total Points
                    </span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black font-display tracking-tight text-emerald-400">
                    Master Solution Key for Checking
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-400 max-w-2xl font-medium">
                    Students: Exchange paper answer sheets or self-check your answers. Teachers can toggle items to reveal solutions step-by-step or display all at once.
                  </p>
                </div>

                {/* Summary Controls */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    onClick={toggleAllSummaryReveal}
                    className={cn(
                      "px-4 py-2.5 rounded-xl border text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all active:scale-95 shadow-sm",
                      allSummaryRevealed
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-500 shadow-emerald-900/30"
                        : themeMode === 'dark'
                          ? "bg-slate-800 border-slate-700 text-slate-300 hover:text-white"
                          : "bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200"
                    )}
                    title="Toggle Reveal on All Answers"
                  >
                    {allSummaryRevealed ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    <span>{allSummaryRevealed ? "All Revealed" : "Hidden (Click to Reveal)"}</span>
                  </button>

                  <button
                    onClick={() => setSummaryViewMode(prev => prev === 'grid' ? 'table' : 'grid')}
                    className={cn(
                      "p-2.5 rounded-xl border text-xs font-bold transition-all",
                      themeMode === 'dark'
                        ? "bg-slate-800 border-slate-700 text-slate-300 hover:text-white"
                        : "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200"
                    )}
                    title={summaryViewMode === 'grid' ? "Switch to Compact Table View" : "Switch to Grid Cards View"}
                  >
                    {summaryViewMode === 'grid' ? <Rows className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
                  </button>

                  <button
                    onClick={handlePrintTest}
                    className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/30 active:scale-95"
                    title="Print Master Solution Sheet"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print Key</span>
                  </button>
                </div>
              </div>

              {/* Answers Display Container */}
              {summaryViewMode === 'grid' ? (
                /* Grid Mode */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[58vh] overflow-y-auto pr-2 scrollbar-thin">
                  {quiz.questions.map((q, idx) => {
                    const isRevealed = revealedQuestions[q.id] !== false;
                    const answerInfo = getAnswerDetail(q);

                    return (
                      <div
                        key={q.id}
                        onClick={() => toggleRevealSingle(q.id)}
                        className={cn(
                          "p-5 rounded-2xl border-2 transition-all flex flex-col justify-between gap-3 cursor-pointer group hover:scale-[1.01] active:scale-[0.99] relative overflow-hidden",
                          isRevealed
                            ? "bg-slate-900/60 border-emerald-500/40 hover:border-emerald-400"
                            : themeMode === 'dark'
                              ? "bg-slate-900/30 border-slate-800 hover:border-slate-700"
                              : "bg-white border-slate-200 hover:border-slate-300 shadow-sm"
                        )}
                      >
                        {/* Card Top: Number, Type, Points */}
                        <div className="flex items-center justify-between gap-2 border-b pb-2.5 border-slate-800/60">
                          <div className="flex items-center gap-2">
                            <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-black text-xs flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                              {q.type.replace('-', ' ')}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-bold text-slate-400">
                              {q.points} {q.points === 1 ? 'pt' : 'pts'}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleQuestionChange(idx, -1);
                              }}
                              className="p-1 hover:bg-white/10 rounded text-[10px] text-indigo-400 font-bold uppercase tracking-wider"
                              title="Jump back to this question slide"
                            >
                              Review Slide
                            </button>
                          </div>
                        </div>

                        {/* Question Prompt */}
                        <p className="text-xs font-medium text-slate-300 line-clamp-2 leading-relaxed">
                          {q.question}
                        </p>

                        {/* Answer Solution Badge */}
                        <div className="pt-2">
                          {isRevealed ? (
                            <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-200 flex items-start gap-2.5">
                              <div className="w-6 h-6 rounded-lg bg-emerald-500 text-slate-950 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                                {answerInfo.letter}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-emerald-300 break-words">
                                  {answerInfo.text}
                                </p>
                              </div>
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                            </div>
                          ) : (
                            <div className="p-3 rounded-xl bg-slate-800/40 border border-dashed border-slate-700 text-slate-400 flex items-center justify-center gap-2 group-hover:text-emerald-400 group-hover:border-emerald-500/40 transition-colors">
                              <EyeOff className="w-3.5 h-3.5" />
                              <span className="text-xs font-bold tracking-wider uppercase">Click to Reveal</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Compact Table Mode */
                <div className={cn(
                  "rounded-2xl border overflow-hidden max-h-[58vh] overflow-y-auto",
                  themeMode === 'dark' ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200 shadow-sm"
                )}>
                  <table className="w-full text-left text-xs">
                    <thead className={cn(
                      "border-b uppercase font-bold text-[10px] tracking-wider sticky top-0 backdrop-blur-md z-10",
                      themeMode === 'dark' ? "bg-slate-950/90 border-slate-800 text-slate-400" : "bg-slate-100 border-slate-200 text-slate-600"
                    )}>
                      <tr>
                        <th className="px-4 py-3 w-16">Item</th>
                        <th className="px-4 py-3">Question Statement</th>
                        <th className="px-4 py-3 w-28">Type</th>
                        <th className="px-4 py-3 w-20">Points</th>
                        <th className="px-4 py-3 w-64">Correct Answer Key</th>
                        <th className="px-4 py-3 w-24 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                      {quiz.questions.map((q, idx) => {
                        const isRevealed = revealedQuestions[q.id] !== false;
                        const answerInfo = getAnswerDetail(q);

                        return (
                          <tr 
                            key={q.id}
                            onClick={() => toggleRevealSingle(q.id)}
                            className={cn(
                              "transition-colors cursor-pointer",
                              themeMode === 'dark' ? "hover:bg-slate-800/50" : "hover:bg-slate-50"
                            )}
                          >
                            <td className="px-4 py-3 font-black text-indigo-400">
                              #{idx + 1}
                            </td>
                            <td className="px-4 py-3 font-medium max-w-xs truncate text-slate-300">
                              {q.question}
                            </td>
                            <td className="px-4 py-3 uppercase text-[10px] font-bold text-slate-400">
                              {q.type.replace('-', ' ')}
                            </td>
                            <td className="px-4 py-3 font-bold text-slate-400">
                              {q.points} pt
                            </td>
                            <td className="px-4 py-3">
                              {isRevealed ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 font-bold">
                                  <strong className="text-emerald-400">{answerInfo.letter}.</strong>
                                  <span className="truncate max-w-[180px]">{answerInfo.text}</span>
                                </span>
                              ) : (
                                <span className="text-slate-500 italic">Click row to reveal</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleQuestionChange(idx, -1);
                                }}
                                className="px-2.5 py-1 rounded bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600 hover:text-white font-bold text-[10px] uppercase tracking-wider transition-all"
                              >
                                Slide
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          ) : currentQuestion ? (
            /* Active Question Slide */
            <motion.div
              key={currentQuestion.id}
              custom={slideDirection}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="w-full space-y-8"
            >
              {/* Question Header Badge */}
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="px-3.5 py-1 rounded-xl bg-indigo-600 text-white font-black text-xs sm:text-sm uppercase tracking-widest shadow-md shadow-indigo-600/30">
                    Question {currentIndex + 1}
                  </span>
                  <span className={cn(
                    "px-3 py-1 rounded-xl border font-bold text-xs uppercase tracking-wider",
                    themeMode === 'dark' ? "bg-slate-900 border-slate-800 text-slate-300" : "bg-slate-100 border-slate-200 text-slate-700"
                  )}>
                    {currentQuestion.points} {currentQuestion.points === 1 ? 'Point' : 'Points'}
                  </span>
                  <span className={cn(
                    "px-3 py-1 rounded-xl border font-bold text-xs uppercase tracking-wider",
                    themeMode === 'dark' ? "bg-slate-900 border-slate-800 text-indigo-400" : "bg-indigo-50 border-indigo-100 text-indigo-700"
                  )}>
                    {currentQuestion.type.replace('-', ' ')}
                  </span>
                </div>

                {showAnswerKey && (
                  <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-bold text-xs uppercase tracking-wider animate-pulse">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Answer Key Revealed</span>
                  </div>
                )}
              </div>

              {/* Question Text Stem */}
              <div className={cn(
                "p-6 sm:p-10 rounded-3xl border transition-all shadow-xl",
                themeMode === 'dark' 
                  ? "bg-slate-900/60 border-slate-800/80 shadow-black/40" 
                  : "bg-white border-slate-200/80 shadow-slate-200/50"
              )}>
                <h2 className={cn("font-display text-balance tracking-tight", getQuestionFontSize())}>
                  {currentQuestion.question}
                </h2>
              </div>

              {/* Options Grid (For Multiple Choice / True False) */}
              {currentQuestion.options && currentQuestion.options.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  {currentQuestion.options.map((option, optIdx) => {
                    const letter = String.fromCharCode(65 + optIdx);
                    const isCorrect = showAnswerKey && (
                      option.trim().toLowerCase() === currentQuestion.correctAnswer.trim().toLowerCase() ||
                      letter.toLowerCase() === currentQuestion.correctAnswer.trim().toLowerCase()
                    );

                    return (
                      <div
                        key={optIdx}
                        className={cn(
                          "p-5 sm:p-7 rounded-2xl border-2 transition-all flex items-center gap-4 relative overflow-hidden",
                          isCorrect
                            ? "bg-emerald-950/40 border-emerald-500 text-emerald-100 ring-2 ring-emerald-500/20"
                            : themeMode === 'dark'
                              ? "bg-slate-900/40 border-slate-800/80 text-slate-200"
                              : "bg-white border-slate-200 text-slate-800 shadow-sm"
                        )}
                      >
                        {/* Letter Marker */}
                        <div className={cn(
                          "w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center font-black text-sm sm:text-base shrink-0 transition-colors",
                          isCorrect
                            ? "bg-emerald-500 text-slate-950"
                            : themeMode === 'dark'
                              ? "bg-slate-800 text-slate-300 border border-slate-700"
                              : "bg-slate-100 text-slate-700 border border-slate-200"
                        )}>
                          {letter}
                        </div>

                        {/* Option Text */}
                        <div className="flex-1 min-w-0">
                          <p className={cn("tracking-tight break-words", getOptionFontSize())}>
                            {option}
                          </p>
                        </div>

                        {/* Correct Checkmark Badge */}
                        {isCorrect && (
                          <div className="px-3 py-1 rounded-lg bg-emerald-500 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-1 shrink-0">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                            <span className="hidden sm:inline">Correct</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Identification / Short Answer Banner */}
              {(!currentQuestion.options || currentQuestion.options.length === 0) && (
                <div className={cn(
                  "p-6 sm:p-8 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4",
                  themeMode === 'dark' ? "bg-slate-900/30 border-slate-800 text-slate-300" : "bg-slate-100/70 border-slate-200 text-slate-700"
                )}>
                  <div className="flex items-center gap-3">
                    <FileText className="w-6 h-6 text-indigo-400 shrink-0" />
                    <div>
                      <p className="font-bold text-sm">Written Response Item</p>
                      <p className="text-xs text-slate-400">Students should write the complete solution / term on their answer paper.</p>
                    </div>
                  </div>

                  {showAnswerKey && (
                    <div className="px-4 py-2 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-emerald-300 text-sm font-bold flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span>Answer: <strong className="text-white underline">{currentQuestion.correctAnswer}</strong></span>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </main>

      {/* Bottom Projection Navigation Footer */}
      <footer className={cn(
        "w-full px-4 sm:px-8 py-4 border-t flex items-center justify-between gap-4 z-40 transition-colors backdrop-blur-md sticky bottom-0",
        themeMode === 'dark' ? "bg-slate-950/90 border-slate-800 text-slate-300" : "bg-white/95 border-slate-200 text-slate-700 shadow-lg"
      )}>
        {/* Previous Button */}
        <button
          onClick={handlePrev}
          disabled={currentIndex === 0}
          className={cn(
            "px-5 sm:px-7 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest flex items-center gap-2 transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none",
            themeMode === 'dark' 
              ? "bg-slate-900 hover:bg-slate-800 border border-slate-800 text-white" 
              : "bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800"
          )}
          title="Previous Slide (Left Arrow)"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Previous</span>
        </button>

        {/* Center: Slide Indicators Dots / Numbers */}
        <div className="flex items-center gap-1.5 overflow-x-auto max-w-[45vw] py-1 px-2 scrollbar-none">
          {quiz.questions.map((q, idx) => (
            <button
              key={q.id}
              onClick={() => handleQuestionChange(idx, idx > currentIndex ? 1 : -1)}
              className={cn(
                "h-8 min-w-[32px] px-2 rounded-xl text-xs font-black transition-all flex items-center justify-center shrink-0",
                idx === currentIndex
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30 scale-110"
                  : themeMode === 'dark'
                    ? "bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
              title={`Jump to Question ${idx + 1}`}
            >
              {idx + 1}
            </button>
          ))}

          {/* End of Slide: Answer Key Pill */}
          <button
            onClick={() => handleQuestionChange(totalQuestions, 1)}
            className={cn(
              "h-8 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0 shadow-sm",
              isSummarySlide
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30 scale-110 ring-2 ring-emerald-400/40"
                : "bg-emerald-950/40 border border-emerald-800/40 text-emerald-400 hover:bg-emerald-900/60"
            )}
            title="Jump to Answer Key Summary"
          >
            <Key className="w-3.5 h-3.5" />
            <span>Answer Key</span>
          </button>
        </div>

        {/* Next / Finish Button */}
        {currentIndex < totalQuestions - 1 ? (
          <button
            onClick={handleNext}
            className="px-6 sm:px-8 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/30 active:scale-95"
            title="Next Question (Right Arrow or Space)"
          >
            <span>Next</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : currentIndex === totalQuestions - 1 ? (
          <button
            onClick={handleNext}
            className="px-6 sm:px-8 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg shadow-emerald-600/30 active:scale-95 animate-pulse"
            title="Go to Answer Key Summary for Checking"
          >
            <Key className="w-4 h-4" />
            <span>Answer Key Summary</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={() => handleQuestionChange(0, -1)}
            className="px-6 sm:px-8 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/30 active:scale-95"
            title="Restart slide presentation from beginning"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Restart Deck</span>
          </button>
        )}
      </footer>

      {/* Question Grid Thumbnail Drawer (G) */}
      <AnimatePresence>
        {showGridDrawer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowGridDrawer(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className={cn(
                "relative w-full max-w-4xl max-h-[85vh] rounded-3xl border shadow-2xl p-6 sm:p-8 flex flex-col gap-6 overflow-hidden",
                themeMode === 'dark' ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
              )}
            >
              <div className="flex items-center justify-between border-b pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-indigo-600/20 text-indigo-400">
                    <Grid className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold font-display">Assessment Navigation Grid</h3>
                    <p className="text-xs text-slate-400 font-medium">Click any slide to jump directly on projector monitor</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowGridDrawer(false)}
                  className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Grid content */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 overflow-y-auto pr-2 max-h-[50vh]">
                {quiz.questions.map((q, idx) => (
                  <button
                    key={q.id}
                    onClick={() => {
                      handleQuestionChange(idx, idx > currentIndex ? 1 : -1);
                      setShowGridDrawer(false);
                    }}
                    className={cn(
                      "p-4 rounded-2xl border text-left transition-all flex flex-col gap-2 relative group",
                      idx === currentIndex
                        ? "bg-indigo-600/20 border-indigo-500 ring-2 ring-indigo-500/20"
                        : themeMode === 'dark'
                          ? "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                          : "bg-slate-50 border-slate-200 hover:border-slate-300"
                    )}
                  >
                    <div className="flex items-center justify-between text-xs font-black uppercase">
                      <span className={idx === currentIndex ? "text-indigo-400" : "text-slate-400"}>
                        Q{idx + 1}
                      </span>
                      <span className="text-[10px] text-slate-500">{q.points} pt</span>
                    </div>
                    <p className="text-xs line-clamp-2 font-medium opacity-80">
                      {q.question}
                    </p>
                  </button>
                ))}

                {/* Grid Item for Master Answer Key Summary */}
                <button
                  onClick={() => {
                    handleQuestionChange(totalQuestions, 1);
                    setShowGridDrawer(false);
                  }}
                  className={cn(
                    "p-4 rounded-2xl border-2 text-left transition-all flex flex-col gap-2 relative group col-span-2 sm:col-span-1 md:col-span-2",
                    isSummarySlide
                      ? "bg-emerald-600/20 border-emerald-500 ring-2 ring-emerald-500/20"
                      : "bg-emerald-950/30 border-emerald-800/40 hover:border-emerald-600"
                  )}
                >
                  <div className="flex items-center justify-between text-xs font-black uppercase text-emerald-400">
                    <span className="flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5" />
                      <span>Answer Key Summary</span>
                    </span>
                    <span className="text-[10px] text-emerald-500 font-bold">End Slide</span>
                  </div>
                  <p className="text-xs font-semibold text-emerald-300">
                    Complete master solution keys for checking student paper tests.
                  </p>
                </button>
              </div>

              <div className="flex items-center justify-between pt-2 border-t text-xs text-slate-400">
                <span>Total Assessment Items: {totalQuestions}</span>
                <button
                  onClick={handlePrintTest}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs uppercase tracking-wider hover:bg-indigo-700 transition-all"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Master Key</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Keyboard Shortcuts Modal (?) */}
      <AnimatePresence>
        {showShortcutsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowShortcutsModal(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className={cn(
                "relative w-full max-w-md rounded-3xl border shadow-2xl p-8 space-y-6",
                themeMode === 'dark' ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-indigo-600/20 text-indigo-400">
                    <Keyboard className="w-5 h-5" />
                  </div>
                  <h3 className="text-xl font-bold font-display">Projector Shortcuts</h3>
                </div>
                <button
                  onClick={() => setShowShortcutsModal(false)}
                  className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2.5 text-xs font-medium">
                <div className="flex items-center justify-between p-2 rounded-xl bg-white/5">
                  <span className="text-slate-400">Next Slide / Next Question</span>
                  <kbd className="px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-white font-mono font-bold">→ or Space</kbd>
                </div>
                <div className="flex items-center justify-between p-2 rounded-xl bg-white/5">
                  <span className="text-slate-400">Previous Slide</span>
                  <kbd className="px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-white font-mono font-bold">←</kbd>
                </div>
                <div className="flex items-center justify-between p-2 rounded-xl bg-white/5">
                  <span className="text-slate-400">Fullscreen Toggle</span>
                  <kbd className="px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-white font-mono font-bold">F</kbd>
                </div>
                <div className="flex items-center justify-between p-2 rounded-xl bg-white/5">
                  <span className="text-slate-400">Classroom Attention / Blackout</span>
                  <kbd className="px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-white font-mono font-bold">B</kbd>
                </div>
                <div className="flex items-center justify-between p-2 rounded-xl bg-white/5">
                  <span className="text-slate-400">Live Answer Key on Current Slide</span>
                  <kbd className="px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-white font-mono font-bold">K</kbd>
                </div>
                <div className="flex items-center justify-between p-2 rounded-xl bg-white/5">
                  <span className="text-slate-400">Slide Navigation Grid</span>
                  <kbd className="px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-white font-mono font-bold">G</kbd>
                </div>
                <div className="flex items-center justify-between p-2 rounded-xl bg-white/5">
                  <span className="text-slate-400">Play / Pause Question Timer</span>
                  <kbd className="px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-white font-mono font-bold">T</kbd>
                </div>
              </div>

              <button
                onClick={() => setShowShortcutsModal(false)}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all shadow-lg"
              >
                Got It
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
