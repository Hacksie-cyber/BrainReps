import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { Quiz, QuizSubmission } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, ArrowLeft, Send, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { cn } from '../lib/utils';

export default function QuizSession() {
  const { id } = useParams();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [finished, setFinished] = useState(false);
  const [lastScore, setLastScore] = useState<{ score: number, total: number, rank: number, totalParticipants: number } | null>(null);
  const [attemptCount, setAttemptCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

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

          setQuiz(quizData);
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

  const handleResponse = (questionId: string, answer: string) => {
    setResponses({ ...responses, [questionId]: answer });
  };

  const handleSubmit = async () => {
    if (!quiz || !profile) return;
    
    setSubmitting(true);
    try {
      let score = 0;
      let totalPoints = 0;
      
      const gradedResponses = quiz.questions.map(q => {
        const studentAnswer = (responses[q.id] || '').trim().toLowerCase();
        const correctAnswer = q.correctAnswer.trim().toLowerCase();
        let pointsEarned = 0;
        let isCorrect = false;

        if (q.type === 'short-answer') {
          const keywords = correctAnswer.split(',').map(k => k.trim()).filter(k => k !== '');
          if (keywords.length > 0) {
            const matches = keywords.filter(k => studentAnswer.includes(k));
            const matchRatio = matches.length / keywords.length;
            pointsEarned = Math.round(matchRatio * q.points * 10) / 10;
            isCorrect = matches.length === keywords.length;
          } else {
            // No keywords defined, check exact match
            isCorrect = studentAnswer === correctAnswer;
            pointsEarned = isCorrect ? q.points : 0;
          }
        } else {
          isCorrect = studentAnswer === correctAnswer;
          pointsEarned = isCorrect ? q.points : 0;
        }

        score += pointsEarned;
        totalPoints += q.points;

        return {
          questionId: q.id,
          answer: responses[q.id] || '',
          isCorrect,
          pointsEarned,
          maxPoints: q.points
        };
      });

      // Round final score to nearest 0.1
      const finalScore = Math.round(score * 10) / 10;

      const submission: Omit<QuizSubmission, 'id'> = {
        quizId: quiz.id,
        quizTitle: quiz.title,
        teacherId: quiz.teacherId, // Added for efficient querying
        studentId: profile.uid,
        studentName: profile.name,
        responses: gradedResponses,
        score: finalScore,
        totalPoints,
        submittedAt: new Date().toISOString(),
        graded: true
      };

      await addDoc(collection(db, 'submissions'), submission);
      
      // Calculate Rank (wrapped in try-catch to prevent submission failure on index/permission issues)
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
        
        const sortedSubs = Array.from(latestSubsMap.values()).sort((a, b) => 
          (b.score / b.totalPoints) - (a.score / a.totalPoints)
        );
        
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
    } catch (error) {
      console.error(error);
      alert("Failed to submit quiz");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex h-[60vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" /></div>;
  if (!quiz) return <div className="text-center py-20 text-slate-500 italic font-medium">Assessment module not found or restricted</div>;

  // Block students if limit is reached
  if (profile?.role === 'student' && quiz.retakeLimit !== 0 && attemptCount >= (quiz.retakeLimit || 1)) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in zoom-in-95 duration-500 px-4">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mb-4 w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 shadow-xl border border-slate-200">
          <AlertCircle className="h-10 w-10" />
        </motion.div>
        <h2 className="mb-2 text-4xl font-extrabold tracking-tight text-slate-900">Attempt Limit Reached</h2>
        <p className="mb-10 text-lg text-slate-500 font-medium max-w-sm mx-auto leading-relaxed">
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
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mb-4 w-20 h-20 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-2xl shadow-emerald-500/30">
          <CheckCircle2 className="h-10 w-10" />
        </motion.div>
        
        <h2 className="mb-2 text-4xl font-extrabold tracking-tight text-slate-900">Submission Confirmed</h2>
        
        {lastScore && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-8 space-y-4"
          >
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Final Achievement Score</p>
              <h3 className="text-5xl font-black text-indigo-600">
                {lastScore.score} <span className="text-xl text-slate-300">/ {lastScore.total}</span>
              </h3>
            </div>

            <div className="flex items-center justify-center gap-4 pt-4 border-t border-slate-50">
               {lastScore.rank > 0 && (
                 <div className="text-center px-6 py-2 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[8px] font-black uppercase text-slate-400 tracking-tighter">Leaderboard Standing</p>
                    <p className="text-xl font-black text-slate-800">Rank #{lastScore.rank}</p>
                 </div>
               )}
               {lastScore.totalParticipants > 0 && (
                 <div className="text-center px-6 py-2 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[8px] font-black uppercase text-slate-400 tracking-tighter">Peer Group Size</p>
                    <p className="text-xl font-black text-slate-400">{lastScore.totalParticipants} <span className="text-[10px]">Total</span></p>
                 </div>
               )}
               {lastScore.rank === 0 && (
                 <p className="text-[9px] font-bold text-slate-400 italic">Leaderboard syncing in progress...</p>
               )}
            </div>
          </motion.div>
        )}

        <p className="mb-10 text-lg text-slate-500 font-medium max-w-sm mx-auto leading-relaxed">
          Your metrics have been recorded. You can now review the correct answers and detailed feedback in your performance dashboard.
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

  return (
    <div className="mx-auto max-w-3xl space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
           <div>
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight">{quiz.title}</h1>
              <div className="flex items-center gap-3 mt-1">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Section Component {currentIndex + 1} of {quiz.questions.length}</p>
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
           <div className="text-right">
              <span className="text-xs font-bold text-indigo-600">{Math.round(progress)}% Complete</span>
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
          className="rounded-xl bg-white p-6 md:p-10 shadow-xl shadow-slate-200/50 border border-slate-200 space-y-8"
        >
          <div className="space-y-4">
            <span className="inline-block rounded-lg bg-slate-50 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-slate-400 border border-slate-100">
              {currentQuestion.type.replace('-', ' ')} Assessment Block
            </span>
            <h2 className="text-xl md:text-2xl font-bold leading-snug text-slate-900 tracking-tight">{currentQuestion.question}</h2>
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
                          ? "border-indigo-600 bg-indigo-50/50 text-indigo-700 ring-4 ring-indigo-600/5"
                          : "border-slate-50 bg-slate-50/30 text-slate-600 hover:border-slate-200 hover:bg-slate-50"
                      )}
                    >
                      <span className="font-bold text-sm tracking-tight">{option}</span>
                      <div className={cn(
                        "h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all",
                         responses[currentQuestion.id] === i.toString() ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-600/20" : "border-slate-200 bg-white"
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
                          ? "border-indigo-600 bg-indigo-50/50 text-indigo-700 ring-4 ring-indigo-600/5"
                          : "border-slate-50 bg-slate-50/30 text-slate-400 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-600"
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
            onClick={handleSubmit}
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

      {!responses[currentQuestion.id] && (
        <p className="flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest text-amber-500 animate-pulse">
          <AlertCircle className="h-3 w-3" />
          Validation required: Input missing
        </p>
      )}
    </div>
  );
}
