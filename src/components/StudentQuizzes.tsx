import { useEffect, useState } from 'react';
import { collection, query, getDocs, orderBy, where, or, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { Quiz, QuizSubmission } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, Search, CheckCircle2, Clock, ArrowRight, ShieldAlert, AlertTriangle, X, Trophy, Star } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { cn, formatDeadline } from '../lib/utils';

export default function StudentQuizzes() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [submissions, setSubmissions] = useState<QuizSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;

    const fetchData = async () => {
      try {
        // Query for quizzes that are global OR specifically assigned to this student
        const q = query(
          collection(db, 'quizzes'),
          or(
            where('isPublic', '==', true),
            where('allowedStudentIds', 'array-contains', profile.uid)
          )
        );
        
        const quizSnap = await getDocs(q);
        const qList = quizSnap.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as Quiz))
          .filter(quiz => !quiz.isHidden) // Secondary UI safety filter
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setQuizzes(qList);

        const subSnap = await getDocs(query(
          collection(db, 'submissions'),
          where('studentId', '==', profile.uid)
        ));
        setSubmissions(subSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as QuizSubmission)));
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [profile]);

  const [topAchievers, setTopAchievers] = useState<Record<string, { name: string, score: number, total: number }>>({});
  const [loadingTop, setLoadingTop] = useState(false);

  useEffect(() => {
    if (!profile || quizzes.length === 0) return;

    const fetchTopAchievers = async () => {
      setLoadingTop(true);
      const achievers: Record<string, any> = {};
      
      try {
        const fetchPromises = quizzes.map(async (quiz) => {
          try {
            const q = query(
              collection(db, 'submissions'),
              where('quizId', '==', quiz.id),
              where('status', '==', 'completed'),
              orderBy('score', 'desc'),
              limit(1)
            );
            const snap = await getDocs(q);
            if (!snap.empty) {
              const data = snap.docs[0].data();
              return { quizId: quiz.id, data: {
                name: data.studentName,
                score: data.score,
                total: data.totalPoints
              }};
            }
          } catch (err: any) {
            // Silently handle index errors or permission errors for individual cards
            if (err.message?.includes('index')) {
              console.warn(`Ranking index missing for quiz ${quiz.id}`);
            }
            return null;
          }
          return null;
        });

        const results = await Promise.all(fetchPromises);
        results.forEach(res => {
          if (res) achievers[res.quizId] = res.data;
        });
        setTopAchievers(achievers);
      } catch (err) {
        console.error("Global top achievers sync failed:", err);
      } finally {
        setLoadingTop(false);
      }
    };

    fetchTopAchievers();
  }, [profile, quizzes]);

  const filteredQuizzes = quizzes.filter(quiz => {
    // Only show non-hidden quizzes to students (teachers see all in StudentQuizzes too if they navigate there, but primarily for students)
    if (quiz.isHidden && profile?.role !== 'teacher') return false;
    
    const isCompleted = submissions.some(s => s.quizId === quiz.id);
    const matchesSearch = quiz.title.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Check if student is allowed to take this quiz
    const isAllowed = quiz.isPublic === true || 
                      (profile && quiz.allowedStudentIds?.includes(profile.uid));
    
    if (!isAllowed && profile?.role !== 'teacher') return false;

    if (filter === 'completed') return isCompleted && matchesSearch;
    if (filter === 'pending') return !isCompleted && matchesSearch;
    return matchesSearch;
  });

  if (loading) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center text-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md space-y-6"
        >
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white mx-auto shadow-xl shadow-indigo-600/20 animate-pulse">
            <BookOpen className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Syncing Curricula...</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed italic">
              Accessing institutional modules and preparing your learning environment.
            </p>
          </div>
          <div className="flex justify-center gap-1.5">
             <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-bounce" style={{ animationDelay: '0ms' }} />
             <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-bounce" style={{ animationDelay: '150ms' }} />
             <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </motion.div>
      </div>
    );
  }

  if (quizzes.length === 0) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center text-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-lg space-y-8"
        >
          <div className="relative mx-auto w-24 h-24">
            <div className="absolute inset-0 bg-indigo-600/10 dark:bg-indigo-400/10 rounded-full animate-ping" />
            <div className="relative w-24 h-24 bg-white dark:bg-slate-900 rounded-full border-2 border-indigo-100 dark:border-indigo-900/50 flex items-center justify-center shadow-sm">
               <BookOpen className="h-10 w-10 text-indigo-600 dark:text-indigo-400" />
            </div>
          </div>
          
          <div className="space-y-4">
            <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
              Institutional <span className="text-indigo-600 dark:text-indigo-400">Curricula</span>
            </h1>
            <p className="text-lg text-slate-500 dark:text-slate-400 font-medium leading-relaxed max-w-sm mx-auto italic">
              Welcome to the Reps Library! There are currently no active modules assigned to your curriculum roster.
            </p>
          </div>

          <Link
            to="/student"
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 dark:bg-indigo-600 px-8 py-4 font-bold text-white transition-all hover:bg-slate-800 dark:hover:bg-indigo-700 shadow-xl shadow-slate-200 dark:shadow-indigo-600/20 active:scale-95 group"
          >
            Back to Dashboard
            <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Curriculum Modules</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Browse and engage with assigned learning assessments.</p>
        </div>
        <div className="flex bg-white dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
          {(['all', 'pending', 'completed'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-4 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all",
                filter === f ? "bg-indigo-600 text-white shadow-md" : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </header>

      <section className="space-y-6">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center gap-3 shadow-sm">
          <Search className="h-5 w-5 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder="Search curricula by title or educator..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-medium text-slate-600 dark:text-slate-300 placeholder:text-slate-300 dark:placeholder:text-slate-600 italic"
          />
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 text-left">
          <AnimatePresence mode="popLayout">
            {filteredQuizzes.length === 0 ? (
               <div className="col-span-full py-20 text-center text-slate-300 italic font-medium">
                  No modules match your current filter parameters.
               </div>
            ) : (
              // Filter out quizzes based on completion/pending status first
              filteredQuizzes.map((quiz, i) => {
                const userSubmissions = submissions.filter(s => s.quizId === quiz.id);
                const latestSubmission = [...userSubmissions].sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())[0];
                const isCompleted = userSubmissions.length > 0;
                const isUnlimitedQuiz = quiz.retakeLimit === 0;
                const limitReached = profile?.role === 'student' && !isUnlimitedQuiz && userSubmissions.length >= (quiz.retakeLimit || 1);
                
                return (
                  <motion.div
                    key={quiz.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: i * 0.05 }}
                    className="group relative flex flex-col bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] hover:-translate-y-1.5 hover:border-indigo-100 dark:hover:border-indigo-900 transition-all duration-300"
                  >
                    <div className="mb-6 flex items-start justify-between">
                      <div className="w-12 h-12 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-xl flex items-center justify-center text-indigo-500 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300 shadow-sm border border-indigo-100/50 dark:border-indigo-900/30">
                        <BookOpen className="h-6 w-6" />
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {isCompleted && (
                           <div className="flex flex-col items-end gap-1.5">
                             <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-[10px] rounded-full border border-emerald-100 dark:border-emerald-800/50 font-bold uppercase tracking-widest shadow-sm">
                                <CheckCircle2 className="h-3 w-3" />
                                {limitReached ? 'Finalized' : 'Attempted'}
                             </div>
                             {latestSubmission && (
                               <div className="flex flex-col items-end">
                                 <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 font-display">
                                   {latestSubmission.score} / {latestSubmission.totalPoints}
                                 </span>
                               </div>
                             )}
                           </div>
                        )}
                        <span className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-[0.1em] bg-slate-50 dark:bg-slate-800/50 px-2 py-0.5 rounded border border-slate-100 dark:border-slate-800">
                          {profile?.role === 'teacher' || isUnlimitedQuiz ? 'Unlimited Retakes' : `Attempts: ${userSubmissions.length} / ${quiz.retakeLimit || 1}`}
                        </span>
                      </div>
                    </div>
                    
                    <h3 className="text-xl font-bold font-display text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors tracking-tight leading-tight mb-2">
                      {quiz.title}
                    </h3>
                    
                    <div className="flex flex-col gap-2.5 mb-5">
                      <div className="flex items-center gap-2 group/educator cursor-help" title={`Curriculum designed by ${quiz.teacherName}`}>
                         <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[8px] font-black text-slate-50 dark:text-slate-400 group-hover/educator:bg-indigo-100 group-hover/educator:text-indigo-600 transition-colors uppercase border border-slate-200/50 dark:border-slate-700/50">
                            {quiz.teacherName?.charAt(0) || 'E'}
                         </div>
                         <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 group-hover/educator:text-slate-900 dark:group-hover/educator:text-slate-100 transition-colors">By {quiz.teacherName}</p>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                          <Clock className="h-3.5 w-3.5 text-slate-300 dark:text-slate-700" />
                          {quiz.questions.length} Items
                        </div>
                        
                        {quiz.deadline && (
                          <div className={cn(
                            "flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-tighter transition-all",
                            new Date(quiz.deadline) < new Date() 
                              ? "bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 border border-red-100 dark:border-red-800/50 animate-pulse" 
                              : "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800/50"
                          )}>
                            <Clock className="h-2.5 w-2.5" />
                            {formatDeadline(quiz.deadline)}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 font-medium leading-relaxed italic line-clamp-2">
                       {quiz.description || "Instructional module for structural logic evaluation."}
                    </p>

                    {topAchievers[quiz.id] && (
                       <div className="mb-6 p-4 bg-amber-50/30 dark:bg-amber-900/10 rounded-xl border border-amber-100/50 dark:border-amber-900/20 flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                             <div className="flex items-center gap-1.5 text-[9px] font-black uppercase text-amber-600 dark:text-amber-500 tracking-widest">
                                <Trophy className="h-2.5 w-2.5" />
                                Top Achiever
                             </div>
                             <div className="flex items-center gap-1 text-[10px] font-black text-amber-700 dark:text-amber-400">
                                <Star className="h-3 w-3 fill-amber-400" />
                                {topAchievers[quiz.id].score} pts
                             </div>
                          </div>
                          <div className="flex items-center gap-2">
                             <div className="flex-1 overflow-hidden">
                                <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{topAchievers[quiz.id].name}</p>
                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Institutional Record</p>
                             </div>
                          </div>
                       </div>
                    )}
                    
                    <div className="mt-auto pt-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      {isCompleted && latestSubmission ? (
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter">Your Best</span>
                          <span className="text-sm font-black text-slate-700 dark:text-slate-200">{Math.round((latestSubmission.score / latestSubmission.totalPoints) * 100)}%</span>
                        </div>
                      ) : (
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter">Status</span>
                          <span className="text-sm font-black text-amber-500">Available</span>
                        </div>
                      )}

                      {limitReached ? (
                        <Link
                          to="/student/performance"
                          className="flex items-center gap-2 rounded-xl bg-slate-50 dark:bg-slate-800 px-5 py-2.5 text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 border border-slate-200 dark:border-slate-700 hover:border-indigo-200 transition-all shadow-sm"
                        >
                          Review Result
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      ) : quiz.deadline && new Date(quiz.deadline) < new Date() ? (
                        <div className="px-5 py-2.5 bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-600 font-bold text-[11px] uppercase tracking-widest rounded-xl border border-slate-200 dark:border-slate-700 opacity-60 flex items-center gap-2">
                          Expired
                        </div>
                      ) : (
                        <button
                          onClick={() => setSelectedQuizId(quiz.id)}
                          className="flex items-center gap-2 rounded-xl bg-indigo-600 dark:bg-indigo-700 px-6 py-3 text-[11px] font-bold uppercase tracking-widest text-white shadow-[0_10px_20px_rgba(79,70,229,0.15)] hover:shadow-[0_15px_30px_rgba(79,70,229,0.3)] hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-all active:scale-95 group/btn"
                        >
                          {isCompleted ? 'Retry Attempt' : 'Launch Module'}
                          <ArrowRight className="h-4 w-4 transform group-hover/btn:translate-x-0.5 transition-transform" />
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* Institutional Security Advisory Modal */}
      <AnimatePresence>
        {selectedQuizId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedQuizId(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800"
            >
              <div className="p-8 space-y-6">
                <div className="flex items-center gap-4 text-amber-600">
                  <div className="w-12 h-12 bg-amber-50 dark:bg-amber-900/20 rounded-xl flex items-center justify-center border border-amber-100 dark:border-amber-800/50">
                    <ShieldAlert className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Security Advisory</h3>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Anti-Cheating Protocol Active</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl p-5 space-y-3">
                    <p className="text-sm text-slate-600 dark:text-slate-300 font-medium leading-relaxed italic">
                      By launching this assessment, you acknowledge that institutional monitoring protocols are in effect.
                    </p>
                    <ul className="space-y-2">
                       <li className="flex items-start gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                         <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                         Window focus is strictly monitored. Switching tabs or opening new apps will terminate the quiz.
                       </li>
                       <li className="flex items-start gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                         <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                         Focus loss results in an INSTANT, automatic submission of your current progress.
                       </li>
                    </ul>
                  </div>

                  <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium text-center">
                    Please ensure all distractions are disabled and your environment is secure.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <button
                    onClick={() => setSelectedQuizId(null)}
                    className="flex-1 px-6 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      const id = selectedQuizId;
                      setSelectedQuizId(null);
                      navigate(`/student/quiz/${id}`);
                    }}
                    className="flex-1 px-6 py-3 rounded-xl bg-slate-900 dark:bg-indigo-600 text-white font-bold text-xs uppercase tracking-widest hover:bg-slate-800 dark:hover:bg-indigo-700 shadow-xl shadow-slate-900/10 dark:shadow-indigo-600/20 transition-all flex items-center justify-center gap-2"
                  >
                    Acknowledge & Launch
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <button 
                onClick={() => setSelectedQuizId(null)}
                className="absolute top-4 right-4 p-2 text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400 transition-colors"
                title="Decline and close"
              >
                <X className="h-5 w-5" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
