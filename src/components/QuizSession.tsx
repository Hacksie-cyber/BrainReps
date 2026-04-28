import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, addDoc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { Quiz, QuizSubmission } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, ArrowLeft, Send, CheckCircle2, AlertCircle, Clock, ShieldAlert, AlertTriangle } from 'lucide-react';
import { cn, formatDeadline } from '../lib/utils';

export default function QuizSession() {
  const { id } = useParams();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const responsesRef = useRef<Record<string, string>>({});
  
  useEffect(() => {
    responsesRef.current = responses;
  }, [responses]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [finished, setFinished] = useState(false);
  const [wasForced, setWasForced] = useState(false);
  const finishedRef = useRef(false);

  useEffect(() => {
    finishedRef.current = finished;
  }, [finished]);
  const [lastScore, setLastScore] = useState<{ score: number, total: number, rank: number, totalParticipants: number } | null>(null);
  const [attemptCount, setAttemptCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [timeTaken, setTimeTaken] = useState(0);
  const [isPastDue, setIsPastDue] = useState(false);
  const [isBlurred, setIsBlurred] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [breachCount, setBreachCount] = useState(0);
  const [showBreachWarning, setShowBreachWarning] = useState(false);
  const lastBreachTimeRef = useRef<number>(0);
  const COOLDOWN_MS = 5000; // 5 second gap between breach triggers

  useEffect(() => {
    // Increment timeTaken every second
    if (finished || loading || !quiz) return;
    const interval = setInterval(() => {
      setTimeTaken(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [finished, loading, quiz]);

  useEffect(() => {
    if (!id || !profile) return;
    const fetchData = async () => {
      try {
        const docRef = doc(db, 'quizzes', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const quizData = { id: docSnap.id, ...docSnap.data() } as Quiz;
          
          if (quizData.isHidden && profile.role !== 'teacher') {
            setQuiz(null);
            return;
          }

          // Randomize questions for students to ensure assessment integrity
          if (profile.role === 'student' && quizData.questions) {
            const shuffledQuestions = [...quizData.questions];
            for (let i = shuffledQuestions.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [shuffledQuestions[i], shuffledQuestions[j]] = [shuffledQuestions[j], shuffledQuestions[i]];
            }
            quizData.questions = shuffledQuestions;
          }

          // Check for cohort access
          const isAllowed = quizData.isPublic === true || 
                            quizData.allowedStudentIds?.includes(profile.uid);
          
          if (!isAllowed && profile.role !== 'teacher') {
            setQuiz(null);
            return;
          }

          setQuiz(quizData);

          // Check if Past Due
          if (quizData.deadline && profile.role === 'student') {
            const deadlineDate = new Date(quizData.deadline);
            if (deadlineDate < new Date()) {
              setIsPastDue(true);
            }
          }

          if (quizData.timeLimit && quizData.timeLimit > 0) {
            setTimeLeft(quizData.timeLimit * 60);
          }

          // Check previous submissions
          const { query, collection, where, getDocs } = await import('firebase/firestore');
          const subQuery = query(
            collection(db, 'submissions'),
            where('quizId', '==', id),
            where('studentId', '==', profile.uid)
          );
          const subSnap = await getDocs(subQuery);
          setAttemptCount(subSnap.docs.length);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, profile]);

  useEffect(() => {
    if (timeLeft === null || finished) return;

    if (timeLeft === 0) {
      handleSubmit();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, finished]);

  // Consolidated Institutional Security Monitor
  useEffect(() => {
    if (finished || loading || !quiz) return;

    const triggerFullBreach = (message: string) => {
      console.warn("Anti-cheating triggered: Integrity breach detected. Auto-submitting...");
      
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const alert = new SpeechSynthesisUtterance(message);
        alert.rate = 1.0;
        alert.volume = 1.0;
        window.speechSynthesis.speak(alert);
      }

      try {
        const sfx = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-security-lock-soft-beep-1077.mp3');
        sfx.volume = 0.5;
        sfx.play().catch(() => {});
      } catch (e) {}
      
      forceSubmit();
    };

    const triggerWarning = (message: string) => {
      setShowBreachWarning(true);
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const alert = new SpeechSynthesisUtterance(message);
        alert.rate = 1.0;
        window.speechSynthesis.speak(alert);
      }
    };

    const handleIntegrityBreach = () => {
      // Cooldown check to prevent continuous triggers
      const now = Date.now();
      if (now - lastBreachTimeRef.current < COOLDOWN_MS) return;

      if ((document.visibilityState === 'hidden' || !document.hasFocus()) && !finishedRef.current) {
        if (profile?.role === 'student') {
          lastBreachTimeRef.current = now;
          setBreachCount(prev => {
            const nextCount = prev + 1;
            if (nextCount === 1) {
              triggerWarning("Academic integrity breach detected. This is your first warning. Any further unauthorized activity will result in immediate termination of this assessment.");
            } else if (nextCount >= 2) {
              triggerFullBreach("Academic Integrity Breach Detected. Academic protocol activated. Assessment auto-submitting for review.");
            }
            return nextCount;
          });
        } else {
          // Instructors only get visual deterrent
          setIsBlurred(true);
        }
      }
    };

    const handleFocus = () => {
      // Allow instructors to return
      if (profile?.role !== 'student') setIsBlurred(false);
    };

    // Deterrents
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'PrintScreen' ||
        (e.ctrlKey && (e.key === 'c' || e.key === 'v' || e.key === 'u' || e.key === 'p')) ||
        (e.ctrlKey && e.shiftKey && e.key === 'I') ||
        (e.metaKey && (e.key === 'c' || e.key === 'v' || e.key === 'u' || e.key === 'p'))
      ) {
        e.preventDefault();
        const now = Date.now();
        if (now - lastBreachTimeRef.current < COOLDOWN_MS) return false;

        if (e.key === 'PrintScreen' && profile?.role === 'student') {
          lastBreachTimeRef.current = now;
          setBreachCount(prev => {
            const nextCount = prev + 1;
            if (nextCount === 1) {
              triggerWarning("Unauthorized screen capture attempt detected. This is your first warning. Any further attempts will result in immediate termination.");
            } else if (nextCount >= 2) {
              triggerFullBreach("Unauthorized screen capture detected. Protocol activated. Terminating session.");
            }
            return nextCount;
          });
        }
        else if (e.key === 'PrintScreen') setIsBlurred(true);
        return false;
      }
    };

    window.addEventListener('visibilitychange', handleIntegrityBreach);
    window.addEventListener('blur', handleIntegrityBreach);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('visibilitychange', handleIntegrityBreach);
      window.removeEventListener('blur', handleIntegrityBreach);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [finished, loading, quiz, profile]);

  const forceSubmit = async () => {
    if (finishedRef.current) return;
    setWasForced(true);
    await handleSubmit(responsesRef.current);
  };

  const [sessionDocId, setSessionDocId] = useState<string | null>(null);
  const savingRef = useRef(false);
  const pendingSaveRef = useRef<Record<string, string> | null>(null);
  const sessionDocIdRef = useRef<string | null>(null);

  useEffect(() => {
    sessionDocIdRef.current = sessionDocId;
  }, [sessionDocId]);

  // Auto-save function to record progress "automatically" as they take the assessment
  const autoSaveSession = async (currentResponses: Record<string, string>, isFinal = false) => {
    if (!quiz || !profile) return { finalScore: 0, totalPoints: 0 };

    if (savingRef.current && !isFinal) {
      pendingSaveRef.current = currentResponses;
      return { finalScore: 0, totalPoints: 0 };
    }

    savingRef.current = true;

    let currentScore = 0;
    let totalPoints = 0;
    let finalScore = 0;

    try {
      const gradedResponses = quiz.questions.map(q => {
        const studentAnswer = (currentResponses[q.id] || '').trim().toLowerCase();
        const correctAnswer = q.correctAnswer.trim().toLowerCase();
        let pointsEarned = 0;
        let isCorrect = false;

        if (q.type === 'short-answer') {
          const keywords = correctAnswer.split(',').map(k => k.trim()).filter(k => k !== '');
          if (keywords.length > 0) {
            const matches = keywords.filter(k => studentAnswer.includes(k));
            pointsEarned = Math.round((matches.length / keywords.length) * q.points * 10) / 10;
            isCorrect = matches.length === keywords.length;
          } else {
            isCorrect = studentAnswer === correctAnswer;
            pointsEarned = isCorrect ? q.points : 0;
          }
        } else {
          isCorrect = studentAnswer === correctAnswer;
          pointsEarned = isCorrect ? q.points : 0;
        }

        currentScore += pointsEarned;
        totalPoints += q.points;

        return {
          questionId: q.id,
          answer: currentResponses[q.id] || '',
          isCorrect,
          pointsEarned,
          maxPoints: q.points
        };
      });

      finalScore = Math.round(currentScore * 10) / 10;
      const submissionAt = new Date().toISOString();
      const submissionData = {
        quizId: quiz.id,
        quizTitle: quiz.title,
        teacherId: quiz.teacherId,
        studentId: profile.uid,
        studentName: profile.name,
        studentRole: profile.role, // Record role for advanced filtering
        isPublicQuiz: quiz.isPublic || false,
        allowedStudentIds: quiz.allowedStudentIds || [],
        responses: gradedResponses,
        score: finalScore,
        totalPoints,
        submittedAt: submissionAt,
        graded: isFinal, // Record as in-progress until finalized
        status: isFinal ? 'completed' : 'in-progress',
        timeTaken: timeTaken // Record duration
      };

      const { doc, setDoc, collection, addDoc, serverTimestamp } = await import('firebase/firestore');
      
      let currentDocId = sessionDocIdRef.current;
      if (currentDocId) {
        await setDoc(doc(db, 'submissions', currentDocId), {
          ...submissionData,
          serverTimestamp: serverTimestamp()
        }, { merge: true });
      } else {
        const docRef = await addDoc(collection(db, 'submissions'), {
          ...submissionData,
          serverTimestamp: serverTimestamp()
        });
        if (!isFinal) {
          setSessionDocId(docRef.id);
          currentDocId = docRef.id;
        }
      }
      
      savingRef.current = false;
      // Handle any saves that were requested during the write
      if (pendingSaveRef.current && !isFinal) {
        const nextSave = pendingSaveRef.current;
        pendingSaveRef.current = null;
        autoSaveSession(nextSave, false);
      }
      
      return { finalScore, totalPoints, submissionAt };
    } catch (error: any) {
      savingRef.current = false;
      console.error("Submission/Auto-save failed:", error);
      
      // FOR FINAL SUBMISSION: Do NOT return fallback successfully.
      // This ensures handleSubmit knows it failed for real.
      if (isFinal) {
         throw error;
      }
      
      // For background auto-saves, we can silently fail or handle gracefully
      return { finalScore: 0, totalPoints: 0, submissionAt: new Date().toISOString() };
    }
  };

  const handleResponse = (questionId: string, answer: string) => {
    const updatedResponses = { ...responses, [questionId]: answer };
    setResponses(updatedResponses);
    // Periodically sync progress automatically
    autoSaveSession(updatedResponses, false);
  };

  const handleSubmit = async (overrideResponses?: Record<string, string>) => {
    if (!quiz || !profile) return;
    
    // Safety: check if overrideResponses is a valid object (not a React event)
    const isValidOverride = overrideResponses && typeof overrideResponses === 'object' && !('nativeEvent' in overrideResponses);
    const finalResponses = isValidOverride ? overrideResponses : responses;
    
    setSubmitting(true);
    try {
      // Execute final score recording automatically
      const { finalScore, totalPoints, submissionAt } = await autoSaveSession(finalResponses, true);
      
      // Calculate Rank for final results
      try {
        const { getDocs, query, where, orderBy } = await import('firebase/firestore');
        const allSubsSnap = await getDocs(query(
          collection(db, 'submissions'),
          where('quizId', '==', quiz.id)
        ));
        
        const allSubs = allSubsSnap.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as QuizSubmission))
          .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
        
        const latestSubsMap = new Map<string, QuizSubmission>();
        allSubs.forEach(sub => {
          if (!latestSubsMap.has(sub.studentId)) {
            latestSubsMap.set(sub.studentId, sub);
          }
        });
        
        const sortedSubs = Array.from(latestSubsMap.values()).sort((a, b) => {
          // 1. Score (Descending)
          if (b.score !== a.score) return b.score - a.score;
          // 2. Efficiency: Time Taken (Ascending)
          const timeA = a.timeTaken || 0;
          const timeB = b.timeTaken || 0;
          if (timeB !== timeA) return timeA - timeB;
          // 3. Chronology: Submission Date (Ascending - first to finish)
          return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
        });
        
        const rank = sortedSubs.findIndex(s => s.studentId === profile.uid) + 1;
        
        setLastScore({ 
          score: finalScore, 
          total: totalPoints, 
          rank, 
          totalParticipants: sortedSubs.length 
        });
      } catch (rankError: any) {
        console.error("Rank calculation skipped:", rankError);
        // Fallback: show score without rank if query fails (e.g. index building)
        setLastScore({ 
          score: finalScore, 
          total: totalPoints, 
          rank: 0, 
          totalParticipants: 0 
        });
      }
      setFinished(true);
    } catch (error: any) {
      console.error("Final Submission Error:", error);
      const isPermissionError = error.message?.includes('permission') || error.code === 'permission-denied';
      const errorMessage = isPermissionError 
        ? "Access Denied: You do not have permission to submit to this repository. Please check your credentials."
        : "Critical Transmission Failure: Your results could not be synchronized with the central repository. Please check your network and try again.";
      
      alert(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    // Legacy security monitor removed - functionality migrated to the Consolidated Institutional Security Monitor
  }, []);

  if (loading) return <div className="flex h-[60vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" /></div>;
  if (!quiz) return <div className="text-center py-20 text-slate-500 italic font-medium">Assessment module not found or restricted</div>;

  // Block students if Past Due
  if (isPastDue) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in zoom-in-95 duration-500 px-4">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mb-4 w-20 h-20 bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center justify-center text-red-500 dark:text-red-400 shadow-xl border border-red-100 dark:border-red-900/50">
          <Clock className="h-10 w-10 text-red-400" />
        </motion.div>
        <h2 className="mb-2 text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">Assessment Expired</h2>
        <p className="mb-10 text-lg text-slate-500 dark:text-slate-400 font-medium max-w-sm mx-auto leading-relaxed">
          The deadline for this module (<b>{formatDeadline(quiz.deadline!)}</b>) has passed. 
          The curriculum is no longer accepting new submissions.
        </p>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <button
            onClick={() => navigate('/student/performance')}
            className="w-full sm:w-auto rounded-xl bg-indigo-600 px-10 py-4 font-bold text-white transition-all hover:bg-indigo-700 shadow-xl shadow-indigo-600/20 active:scale-95"
          >
            Review Achievement
          </button>
          <button
            onClick={() => navigate('/student')}
            className="w-full sm:w-auto rounded-xl bg-slate-100 px-10 py-4 font-bold text-slate-600 transition-all hover:bg-slate-200 active:scale-95"
          >
            Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Block students if limit is reached
  if (profile?.role === 'student' && quiz.retakeLimit !== 0 && attemptCount >= (quiz.retakeLimit || 1)) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in zoom-in-95 duration-500 px-4">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mb-4 w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-400 dark:text-slate-500 shadow-xl border border-slate-200 dark:border-slate-700">
          <AlertCircle className="h-10 w-10" />
        </motion.div>
        <h2 className="mb-2 text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">Attempt Limit Reached</h2>
        <p className="mb-10 text-lg text-slate-500 dark:text-slate-400 font-medium max-w-sm mx-auto leading-relaxed">
          The teacher has set a maximum of <b>{quiz.retakeLimit === 0 ? 'Unlimited' : `${quiz.retakeLimit} attempt(s)`}</b> for this assessment. 
          Please consult your performance dashboard for detailed results.
        </p>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <button
            onClick={() => navigate('/student/performance')}
            className="w-full sm:w-auto rounded-xl bg-indigo-600 px-10 py-4 font-bold text-white transition-all hover:bg-indigo-700 shadow-xl shadow-indigo-600/20 active:scale-95"
          >
            Go to Results
          </button>
          <button
            onClick={() => navigate('/student')}
            className="w-full sm:w-auto rounded-xl bg-slate-100 px-10 py-4 font-bold text-slate-600 transition-all hover:bg-slate-200 active:scale-95"
          >
            Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (finished) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in zoom-in-95 duration-500 px-4">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className={cn(
          "mb-4 w-20 h-20 rounded-2xl flex items-center justify-center text-white shadow-2xl transition-all",
          wasForced ? "bg-amber-500 shadow-amber-500/30" : "bg-emerald-500 shadow-emerald-500/30"
        )}>
          {wasForced ? <ShieldAlert className="h-10 w-10" /> : <CheckCircle2 className="h-10 w-10" />}
        </motion.div>
        
        <h2 className="mb-2 text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          {wasForced ? "Security Finalization" : "Submission Confirmed"}
        </h2>
        {wasForced && (
          <p className="mb-6 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-xs font-bold rounded-lg border border-amber-100 dark:border-amber-800/50 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Assessment terminated due to window focus loss. Academic integrity protocols enforced.
          </p>
        )}
        
        {lastScore && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-8 space-y-4"
          >
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest mb-1">Final Achievement Score</p>
              <h3 className="text-5xl font-black text-indigo-600 dark:text-indigo-400">
                {lastScore.score} <span className="text-xl text-slate-300 dark:text-slate-600">/ {lastScore.total}</span>
              </h3>
            </div>

            <div className="flex items-center justify-center gap-4 pt-4 border-t border-slate-50 dark:border-slate-800">
               {lastScore.rank > 0 && (
                 <div className="text-center px-6 py-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                    <p className="text-[8px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-tighter">Leaderboard Standing</p>
                    <p className="text-xl font-black text-slate-800 dark:text-slate-100">Rank #{lastScore.rank}</p>
                 </div>
               )}
               {lastScore.totalParticipants > 0 && (
                 <div className="text-center px-6 py-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                    <p className="text-[8px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-tighter">Peer Group Size</p>
                    <p className="text-xl font-black text-slate-400 dark:text-slate-600">{lastScore.totalParticipants} <span className="text-[10px]">Total</span></p>
                 </div>
               )}
               {lastScore.rank === 0 && (
                 <p className="text-[9px] font-bold text-slate-400 italic">Leaderboard syncing in progress...</p>
               )}
            </div>
          </motion.div>
        )}

        <p className="mb-10 text-lg text-slate-500 dark:text-slate-400 font-medium max-w-sm mx-auto leading-relaxed">
          Your metrics have been recorded. You can now review your score and detailed performance breakdown in your dashboard.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <button
            onClick={() => navigate('/student/performance')}
            className="w-full sm:w-auto rounded-xl bg-indigo-600 px-10 py-4 font-bold text-white transition-all hover:bg-indigo-700 shadow-xl shadow-indigo-600/20 active:scale-95"
          >
            Review Achievement
          </button>
          <button
            onClick={() => navigate(profile?.role === 'teacher' ? '/teacher' : '/student')}
            className="w-full sm:w-auto rounded-xl bg-slate-100 px-10 py-4 font-bold text-slate-600 transition-all hover:bg-slate-200 active:scale-95"
          >
            Return to Hub
          </button>
        </div>
      </div>
    );
  }

  const currentQuestion = quiz.questions[currentIndex];
  const progress = ((currentIndex + 1) / quiz.questions.length) * 100;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate current score live
  const calculateCurrentLiveScore = () => {
    if (!quiz) return 0;
    let earned = 0;
    let total = 0;
    quiz.questions.forEach(q => {
      const studentAnswer = (responses[q.id] || '').trim().toLowerCase();
      const correctAnswer = q.correctAnswer.trim().toLowerCase();
      if (studentAnswer === correctAnswer) {
        earned += q.points;
      }
      total += q.points;
    });
    return Math.round((earned / total) * 100);
  };

  return (
    <div className={cn(
      "mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in slide-in-from-bottom-4 duration-500 select-none",
      isBlurred && "blur-[100px] opacity-0 transition-none pointer-events-none"
    )}>
      {isBlurred && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white text-center p-6 transition-none">
           <div className="max-w-md space-y-6">
              <div className="mx-auto w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center">
                 <ShieldAlert className="w-8 h-8 text-amber-500" />
              </div>
              <div className="space-y-2">
                 <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">Security Protocol Active</h2>
                 <p className="text-slate-500 dark:text-slate-400 text-sm font-medium leading-relaxed">
                    Access to assessment content is restricted while the window is out of focus. This measure ensures curriculum integrity and prevents unauthorized content capture.
                 </p>
              </div>
              <button 
                onClick={() => setIsBlurred(false)}
                className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
              >
                Restore Session
              </button>
           </div>
        </div>
      )}
      
      <div className="w-full space-y-8 max-w-4xl mx-auto">
        {/* Main Content Viewport */}
        <div className="w-full space-y-8">
          <header className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
               <div>
                  <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">{quiz.title}</h1>
                  <div className="flex items-center gap-3 mt-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Section Component {currentIndex + 1} of {quiz.questions.length}</p>
                    {timeLeft !== null && (
                       <div className={cn(
                         "flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] font-black uppercase tracking-tighter transition-colors",
                         timeLeft < 60 ? "bg-red-50 text-red-600 border-red-100 animate-pulse" : "bg-indigo-50 text-indigo-700 border-indigo-100"
                       )}>
                          <Clock className="w-3 h-3" />
                          {formatTime(timeLeft)} Remaining
                       </div>
                    )}
                  </div>
               </div>
               <div className="flex flex-col items-end gap-1.5 min-w-[70px]">
                  <span className="text-[10px] font-black text-indigo-600 uppercase tracking-tighter whitespace-nowrap">{Math.round(progress)}% Complete</span>
                  <button
                    onClick={() => setShowConfirmModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-600 rounded-lg border border-red-100 hover:bg-red-200 transition-all text-[10px] font-black uppercase tracking-widest shadow-sm active:scale-95"
                  >
                    <Send className="w-2.5 h-2.5" />
                    End
                  </button>
               </div>
            </div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-600 transition-all duration-700 ease-out shadow-[0_0_8px_rgba(79,70,229,0.5)]" style={{ width: `${progress}%` }} />
            </div>
            {profile?.role === 'teacher' && (
              <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-lg animate-in slide-in-from-top-1 duration-500">
                <CheckCircle2 className="h-4 w-4 text-indigo-600" />
                <p className="text-[10px] font-black uppercase text-indigo-700 tracking-widest">Review Mode: Your metrics will be recorded as a test submission.</p>
              </div>
            )}
          </header>

          <section className="min-h-[400px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentQuestion.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="rounded-xl bg-white dark:bg-slate-900 p-6 md:p-10 shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-200 dark:border-slate-800 space-y-8"
              >
                {/* Question UI Remains the same */}
                <div className="space-y-4">
                  <span className="inline-block rounded-lg bg-slate-50 dark:bg-slate-800 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 border border-slate-100 dark:border-slate-800">
                    {currentQuestion.type.replace('-', ' ')} Assessment Block
                  </span>
                  <h2 className="text-xl md:text-2xl font-bold leading-snug text-slate-900 dark:text-white tracking-tight">{currentQuestion.question}</h2>
                </div>

                <div className="space-y-3">
                  {currentQuestion.type === 'multiple-choice' && currentQuestion.options && (
                    <div className="grid gap-3">
                      {currentQuestion.options.map((option, i) => (
                        <button
                          key={i}
                          onClick={() => handleResponse(currentQuestion.id, i.toString())}
                          className={cn(
                            "group flex items-center justify-between rounded-xl border-2 p-5 transition-all text-left",
                            responses[currentQuestion.id] === i.toString()
                              ? "border-indigo-600 dark:border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 ring-4 ring-indigo-600/5"
                              : "border-slate-50 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/30 text-slate-600 dark:text-slate-400 hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                          )}
                        >
                          <span className="font-bold text-sm tracking-tight">{option}</span>
                          <div className={cn(
                            "h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all",
                             responses[currentQuestion.id] === i.toString() ? "bg-indigo-600 dark:bg-indigo-500 border-indigo-600 dark:border-indigo-500 text-white shadow-lg shadow-indigo-600/20" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                          )}>
                            {responses[currentQuestion.id] === i.toString() && <CheckCircle2 className="h-3 w-3" />}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {currentQuestion.type === 'true-false' && (
                    <div className="grid grid-cols-2 gap-4">
                      {['true', 'false'].map((val) => (
                        <button
                          key={val}
                          onClick={() => handleResponse(currentQuestion.id, val)}
                          className={cn(
                            "flex flex-col items-center justify-center gap-4 rounded-xl border-2 py-8 md:py-12 transition-all group",
                            responses[currentQuestion.id] === val
                              ? "border-indigo-600 dark:border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 ring-4 ring-indigo-600/5"
                              : "border-slate-50 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/30 text-slate-400 dark:text-slate-500 hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-300"
                          )}
                        >
                          <span className="text-base md:text-xl font-black uppercase tracking-[0.2em]">{val}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {currentQuestion.type === 'short-answer' && (
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Strategic Response Input</label>
                      <textarea
                        value={responses[currentQuestion.id] || ''}
                        onBlur={(e) => (e.target.value = e.target.value.trim())}
                        onChange={(e) => handleResponse(currentQuestion.id, e.target.value)}
                        placeholder="Formulate your response with precision..."
                        className="w-full h-40 rounded-xl border border-slate-100 bg-slate-50/50 p-6 text-base font-medium text-slate-700 focus:bg-white focus:border-indigo-600/20 focus:ring-4 focus:ring-indigo-600/5 focus:outline-none transition-all resize-none placeholder:text-slate-300 italic"
                      />
                    </div>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </section>

          <footer className="flex items-center justify-between gap-4 pt-6 border-t border-slate-100">
            <button
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex(currentIndex - 1)}
              className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 md:px-6 py-3 font-bold text-xs text-slate-400 transition-all hover:text-slate-800 hover:bg-slate-50 disabled:opacity-0"
            >
              <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Previous Case</span>
            </button>

            {currentIndex === quiz.questions.length - 1 ? (
              <button
                onClick={() => handleSubmit()}
                disabled={submitting || !responses[currentQuestion.id]}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 md:px-8 py-3 font-bold text-xs text-white shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-700 active:scale-95 disabled:opacity-50"
              >
                {submitting ? 'Transmitting...' : 'Finalize'}
                <Send className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                disabled={!responses[currentQuestion.id]}
                onClick={() => setCurrentIndex(currentIndex + 1)}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 md:px-8 py-3 font-bold text-xs text-white shadow-lg shadow-indigo-600/20 transition-all hover:bg-indigo-700 active:scale-95 disabled:opacity-50"
              >
                Advance
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </footer>
        </div>
      </div>

      {/* Early Submission Confirmation Modal */}
      <AnimatePresence>
        {showConfirmModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowConfirmModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl p-8 space-y-6"
            >
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center">
                  <AlertCircle className="w-8 h-8 text-red-500" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-800 tracking-tight uppercase">End Assessment?</h3>
                  <p className="text-sm text-slate-500 font-medium leading-relaxed mt-2">
                    You are attempting to end your session before completing all curriculum components. Once finalized, your current assertions will be submitted for permanent record.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    setShowConfirmModal(false);
                    handleSubmit();
                  }}
                  disabled={submitting}
                  className="w-full py-4 bg-red-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-600/20 active:scale-95"
                >
                  {submitting ? 'Transmitting...' : 'Confirm Submission'}
                </button>
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="w-full py-4 bg-slate-50 text-slate-400 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-100 transition-all"
                >
                  Continue Assessment
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Breach Warning Modal */}
      <AnimatePresence>
        {showBreachWarning && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[2rem] shadow-[0_0_50px_rgba(239,68,68,0.2)] p-10 border border-red-100 dark:border-red-900/30 overflow-hidden"
            >
              {/* Security Background Pattern */}
              <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
                <div className="absolute inset-0" style={{ 
                  backgroundImage: 'radial-gradient(circle at 2px 2px, #ef4444 1px, transparent 0)',
                  backgroundSize: '16px 16px'
                }} />
              </div>

              <div className="relative flex flex-col items-center text-center space-y-8">
                <div className="relative">
                  <motion.div 
                    animate={{ 
                      scale: [1, 1.1, 1],
                      rotate: [0, 5, -5, 0]
                    }}
                    transition={{ duration: 0.5, repeat: 3 }}
                    className="w-24 h-24 bg-red-50 dark:bg-red-900/20 rounded-3xl flex items-center justify-center border-2 border-red-100 dark:border-red-900/50"
                  >
                    <ShieldAlert className="w-12 h-12 text-red-500" />
                  </motion.div>
                  <div className="absolute -top-2 -right-2 px-3 py-1 bg-red-600 text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg">
                    Warning 01
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight uppercase">Integrity Alert</h3>
                  <div className="h-1 w-20 bg-red-500 mx-auto rounded-full" />
                  <p className="text-slate-500 dark:text-slate-400 font-bold leading-relaxed text-sm">
                    Our institutional security monitor has detected an unauthorized deviation from the assessment environment. 
                  </p>
                  <p className="px-6 py-4 bg-red-50 dark:bg-red-900/10 text-red-700 dark:text-red-400 text-sm font-black rounded-2xl border border-red-100 dark:border-red-900/20 italic">
                    "This is your FINAL WARNING. Any further breach will trigger immediate session termination and auto-submission."
                  </p>
                </div>

                <button
                  onClick={() => setShowBreachWarning(false)}
                  className="group relative w-full overflow-hidden rounded-2xl bg-slate-900 dark:bg-white px-8 py-5 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <div className="absolute inset-0 bg-red-600 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                  <span className="relative font-black text-xs uppercase tracking-[0.3em] text-white dark:text-slate-900 group-hover:text-white">
                    I Acknowledge & Resume
                  </span>
                </button>
                
                <p className="text-[10px] text-slate-400 dark:text-slate-600 font-black uppercase tracking-widest">
                  Protocol: BR-SEC-ATTEMPT-01
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {!responses[currentQuestion.id] && (
        <p className="flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest text-amber-500 animate-pulse">
          <AlertCircle className="h-3 w-3" />
          Validation required: Input missing
        </p>
      )}
    </div>
  );
}
