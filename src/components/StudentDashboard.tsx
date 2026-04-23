import { useEffect, useState } from 'react';
import { collection, query, getDocs, orderBy, where, or, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { Quiz, QuizSubmission } from '../types';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { BookOpen, Trophy, Clock, Search, ArrowRight, CheckCircle2, History } from 'lucide-react';
import { cn, formatDeadline } from '../lib/utils';

export default function StudentDashboard() {
  const { profile } = useAuth();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [submissions, setSubmissions] = useState<QuizSubmission[]>([]);
  const [allSubmissions, setAllSubmissions] = useState<QuizSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!profile) return;

    // 1. Fetch assessments
    const fetchQuizzes = async () => {
      try {
        const q = query(
          collection(db, 'quizzes'),
          or(
            where('isPublic', '==', true),
            where('allowedStudentIds', 'array-contains', profile.uid)
          )
        );
        const quizSnap = await getDocs(q);
        const quizList = quizSnap.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as Quiz))
          .filter(q => !q.isHidden)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setQuizzes(quizList);
      } catch (error) {
        console.error("Quiz fetch failed:", error);
      }
    };

    // 2. Real-time sync for current user's submissions
    const qUserSubs = query(
      collection(db, 'submissions'),
      where('studentId', '==', profile.uid)
    );
    const unsubUser = onSnapshot(qUserSubs, (snapshot) => {
      const subList = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as QuizSubmission))
        .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
      setSubmissions(subList);
    });

    // 3. Real-time sync for ALL institutional submissions (for Rankings/Top 1)
    // Note: We fetch all and filter in memory to handle legacy docs without 'studentRole'
    const unsubAll = onSnapshot(collection(db, 'submissions'), (snapshot) => {
      const allList = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as QuizSubmission))
        .filter(s => s.studentRole !== 'teacher' && s.studentRole !== 'admin'); // Be inclusive of old docs
      setAllSubmissions(allList);
      setLoading(false);
    });

    fetchQuizzes();

    return () => {
      unsubUser();
      unsubAll();
    };
  }, [profile]);

  const filteredQuizzes = quizzes.filter(q => {
    if (q.isHidden && profile?.role !== 'teacher') return false;
    
    // Check if student is allowed to take this quiz
    const isAllowed = q.isPublic === true || 
                      (profile && q.allowedStudentIds?.includes(profile.uid));
    
    if (!isAllowed && profile?.role !== 'teacher') return false;

    return q.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
           q.teacherName.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  // Count unique modules mastered (Score >= 75%)
  const modulesBestScores: Record<string, number> = {};
  submissions.forEach(s => {
    const percent = (s.score / s.totalPoints);
    if (!modulesBestScores[s.quizId] || percent > modulesBestScores[s.quizId]) {
      modulesBestScores[s.quizId] = percent;
    }
  });

  const masteredIds = Object.keys(modulesBestScores).filter(id => modulesBestScores[id] >= 0.75);
  
  const thisWeekUniqueIds = new Set(
    submissions
      .filter(s => new Date(s.submittedAt) >= sevenDaysAgo)
      .map(s => s.quizId)
  );

  const stats = {
    completed: masteredIds.length,
    thisWeek: thisWeekUniqueIds.size,
    avgScore: submissions.length > 0
      ? Math.round((submissions.reduce((acc, curr) => acc + (curr.score / curr.totalPoints), 0) / submissions.length) * 100)
      : 0,
    topScore: submissions.length > 0
      ? Math.max(...submissions.map(s => Math.round((s.score / s.totalPoints) * 100)))
      : 0
  };

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
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Welcome back, {profile?.name}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed italic">
              Initializing your curriculum and synchronizing institutional data. Please wait while we prepare your customized experience.
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
               <Trophy className="h-10 w-10 text-indigo-600 dark:text-indigo-400" />
            </div>
          </div>
          
          <div className="space-y-4">
            <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
              Welcome to your <span className="text-indigo-600 dark:text-indigo-400">Learning Hub</span>
            </h1>
            <p className="text-lg text-slate-500 dark:text-slate-400 font-medium leading-relaxed max-w-sm mx-auto italic">
              You're all caught up for now! No instructional assessments have been assigned to your profile yet.
            </p>
          </div>

          <div className="pt-4 grid sm:grid-cols-2 gap-4">
             <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 text-left">
                <p className="text-[10px] font-black uppercase text-indigo-600 mb-1 tracking-widest">Next Steps</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">Contact your faculty to request module enrollment.</p>
             </div>
             <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 text-left">
                <p className="text-[10px] font-black uppercase text-emerald-600 mb-1 tracking-widest">Growth</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">Review your past performance in the analytics tab.</p>
             </div>
          </div>

          <Link
            to="/student/performance"
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 dark:bg-indigo-600 px-8 py-4 font-bold text-white transition-all hover:bg-slate-800 dark:hover:bg-indigo-700 shadow-xl shadow-slate-200 dark:shadow-indigo-600/20 active:scale-95 group"
          >
            Review Transcripts
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
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Active Learning Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Review your progress and explore upcoming assessments.</p>
        </div>
      </header>

      {/* Stats Overview */}
      <section className="grid gap-6 sm:grid-cols-3">
        <div className="bg-white dark:bg-slate-900 p-7 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-all hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] group">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Curricula Completed</p>
            <CheckCircle2 className="h-4 w-4 text-emerald-500 group-hover:scale-110 transition-transform" />
          </div>
          <div className="flex items-baseline gap-2">
            <h3 className="text-4xl font-bold font-display text-slate-900 dark:text-slate-50 leading-none">{stats.completed}</h3>
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">+{stats.thisWeek} this week</span>
          </div>
        </div>
        
        <div className="bg-white dark:bg-slate-900 p-7 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-all hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] group">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-3">Academic Score</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-4xl font-bold font-display text-slate-900 dark:text-slate-50 leading-none">{stats.avgScore}%</h3>
          </div>
          <div className="mt-4 w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div className="bg-indigo-600 h-full transition-all duration-1000 ease-out shadow-[0_0_8px_rgba(79,70,229,0.4)]" style={{ width: `${stats.avgScore}%` }}></div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-slate-900 p-7 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-all hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] group">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Record Achievement</p>
            <Trophy className="h-4 w-4 text-amber-500 group-hover:scale-110 transition-transform" />
          </div>
          <div className="flex items-baseline gap-2">
            <h3 className="text-4xl font-bold font-display text-slate-900 dark:text-slate-50 leading-none">{stats.topScore}%</h3>
          </div>
        </div>
      </section>

      {/* Quiz Discovery */}
      <section className="space-y-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm transition-colors">
          <h2 className="flex items-center gap-3 font-bold font-display text-slate-800 dark:text-slate-100">
            <Search className="h-5 w-5 text-indigo-500" />
            Find Assessment
          </h2>
          <div className="relative w-full md:w-96">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by module title or educator..."
              className="w-full rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 py-3 pl-5 pr-12 text-sm text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600/20 outline-none transition-all font-medium placeholder:text-slate-400 dark:placeholder:text-slate-600"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-100 dark:border-slate-800">
               <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
            </div>
          </div>
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {filteredQuizzes.length === 0 ? (
            <div className="col-span-full py-16 text-center">
              <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100 dark:border-slate-800">
                 <Search className="h-6 w-6 text-slate-300" />
              </div>
              <p className="text-slate-400 dark:text-slate-600 italic font-medium tracking-tight">No learning modules matched your query.</p>
            </div>
          ) : (
            filteredQuizzes.map((quiz, i) => {
              const submission = submissions.find(s => s.quizId === quiz.id);
              const userSubs = submissions.filter(s => s.quizId === quiz.id);
              const isUnlimited = profile?.role === 'teacher' || quiz.retakeLimit === 0;
              const limitReached = !isUnlimited && userSubs.length >= (quiz.retakeLimit || 1);

              // Ranking Logic
              const quizAllSubs = allSubmissions.filter(s => s.quizId === quiz.id);
              const latestSubsMap = new Map<string, QuizSubmission>();
              quizAllSubs.forEach(s => {
                const existing = latestSubsMap.get(s.studentId);
                // Use best score for competitive metrics
                if (!existing || s.score > existing.score) {
                  latestSubsMap.set(s.studentId, s);
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

              const top1 = sortedSubs[0];
              const myRank = submission ? sortedSubs.findIndex(s => s.studentId === profile?.uid) + 1 : 0;

              return (
                <motion.div
                  key={quiz.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="group relative flex flex-col bg-white dark:bg-slate-900 p-7 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] hover:-translate-y-1.5 hover:border-indigo-100 dark:hover:border-indigo-900 transition-all duration-300"
                >
                  <div className="mb-6 flex items-start justify-between">
                    <div className="w-12 h-12 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-xl flex items-center justify-center text-indigo-500 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300 shadow-sm border border-indigo-100/50 dark:border-indigo-900/30">
                      <BookOpen className="h-6 w-6" />
                    </div>
                    <div className="flex flex-col items-end gap-2">
                       {submission && (
                         <div className="flex flex-col items-end gap-1.5">
                           <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-[10px] rounded-full border border-emerald-100 dark:border-emerald-800/50 font-bold uppercase tracking-widest shadow-sm">
                              <CheckCircle2 className="h-3 w-3" />
                              Attempted
                           </div>
                           <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 font-display">
                              {Math.round((submission.score / submission.totalPoints) * 100)}%
                           </span>
                         </div>
                       )}
                       <span className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-[0.1em] bg-slate-50 dark:bg-slate-800/50 px-2.5 py-1 rounded border border-slate-100 dark:border-slate-800">
                          {isUnlimited ? 'Unlimited' : `Attempts: ${userSubs.length} / ${quiz.retakeLimit || 1}`}
                        </span>
                    </div>
                  </div>
                  
                  <h3 className="text-xl font-bold font-display text-slate-900 dark:text-slate-50 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors tracking-tight leading-tight mb-2">
                    {quiz.title}
                  </h3>
                  
                  <div className="flex flex-col gap-2.5 mb-5">
                    <div className="flex items-center gap-2 group/educator cursor-help" title={`Curriculum designed by ${quiz.teacherName}`}>
                       <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[8px] font-black text-slate-500 group-hover/educator:bg-indigo-100 group-hover/educator:text-indigo-600 transition-colors uppercase border border-slate-200/50 dark:border-slate-700/50">
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
                            ? "bg-red-50 text-red-500 border border-red-100 animate-pulse" 
                            : "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800/50"
                        )}>
                          <Clock className="h-2.5 w-2.5" />
                          {formatDeadline(quiz.deadline)}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 font-medium leading-relaxed italic line-clamp-2">
                    {quiz.description || "Instructional module for structural logic evaluation."}
                  </p>
                  
                  {/* Competitive Metrics */}
                  <div className="mb-8 space-y-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800/50 transition-colors group-hover:bg-white dark:group-hover:bg-slate-800">
                     <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                           <Trophy className="h-3.5 w-3.5 text-amber-500" />
                           <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Top Achievement</span>
                        </div>
                        {top1 ? (
                          <p className="text-[10px] font-bold text-slate-700 dark:text-slate-200">{top1.studentName} <span className="text-amber-500 ml-1">({top1.score}pts)</span></p>
                        ) : (
                          <p className="text-[10px] font-medium text-slate-300 italic uppercase">Awaiting results</p>
                        )}
                     </div>
                     
                     <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                           <div className="w-3.5 h-3.5 rounded bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                              <span className="text-[8px] font-black text-indigo-600">#</span>
                           </div>
                           <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Institutional Rank</span>
                        </div>
                        {myRank > 0 ? (
                           <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-tighter">Rank #{myRank} <span className="text-[8px] text-slate-400 font-bold ml-1">/ {sortedSubs.length}</span></p>
                        ) : (
                           <p className="text-[10px] font-medium text-slate-300 italic uppercase">Not Ranked</p>
                        )}
                     </div>
                  </div>
                  
                  <div className="mt-auto pt-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    {submission ? (
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter">Your Score</span>
                        <span className="text-sm font-black text-slate-700 dark:text-slate-200">{submission.score} / {submission.totalPoints}</span>
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
                        className="flex items-center gap-2 rounded-xl bg-slate-50 dark:bg-slate-800 px-5 py-2.5 text-[11px] font-bold uppercase tracking-widest text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 dark:border-slate-700 hover:border-indigo-200 transition-all shadow-sm"
                      >
                        Review
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    ) : quiz.deadline && new Date(quiz.deadline) < new Date() ? (
                      <div className="px-5 py-2.5 bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-600 font-bold text-[11px] uppercase tracking-widest rounded-xl border border-slate-200 dark:border-slate-700 opacity-60 flex items-center gap-2">
                        Expired
                      </div>
                    ) : (
                      <Link
                        to={`/student/quiz/${quiz.id}`}
                        className="flex items-center gap-2 rounded-xl bg-indigo-600 dark:bg-indigo-700 px-6 py-3 text-[11px] font-bold uppercase tracking-widest text-white shadow-[0_10px_20px_rgba(79,70,229,0.15)] hover:shadow-[0_15px_30px_rgba(79,70,229,0.3)] hover:bg-indigo-700 transition-all active:scale-95 group/btn"
                      >
                        {submission ? 'Retry' : 'Access'}
                        <ArrowRight className="h-4 w-4 transform group-hover/btn:translate-x-0.5 transition-transform" />
                      </Link>
                    )}
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </section>

      {/* History */}
      {submissions.length > 0 && (
        <section className="space-y-6">
          <h2 className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-100">
            <History className="h-4 w-4 text-slate-400 dark:text-slate-500" />
            Academic Transcripts
          </h2>
          <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm transition-colors">
             {/* Desktop Table View */}
             <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800">
                    <tr className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                        <th className="px-6 py-3">Assessment</th>
                        <th className="px-6 py-3 text-center">Submission Date</th>
                        <th className="px-6 py-3 text-center">Deadline</th>
                        <th className="px-6 py-3 text-right">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                    {submissions.slice(0, 5).map((sub) => (
                        <tr key={sub.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                          <td className="px-6 py-4">
                              <p className="text-sm font-bold text-slate-700 dark:text-slate-200 tracking-tight">{sub.quizTitle}</p>
                          </td>
                          <td className="px-6 py-4 text-center">
                              <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase">{new Date(sub.submittedAt).toLocaleDateString()}</p>
                          </td>
                          <td className="px-6 py-4 text-center">
                              {quizzes.find(q => q.id === sub.quizId)?.deadline ? (
                                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter">
                                   {formatDeadline(quizzes.find(q => q.id === sub.quizId)!.deadline!)}
                                </p>
                              ) : (
                                <p className="text-[10px] font-bold text-slate-300 dark:text-slate-700 uppercase tracking-tighter italic">N/A</p>
                              )}
                          </td>
                          <td className="px-6 py-4 text-right">
                              <div className="flex flex-col items-end">
                                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{sub.score} / {sub.totalPoints}</p>
                                <div className="mt-1.5 h-1 w-20 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div 
                                      className={cn("h-full transition-all duration-1000", (sub.score / sub.totalPoints) >= 0.7 ? "bg-indigo-600 dark:bg-indigo-400" : "bg-indigo-200 dark:bg-indigo-900/40")} 
                                      style={{ width: `${(sub.score / sub.totalPoints) * 100}%` }}
                                    />
                                </div>
                              </div>
                          </td>
                        </tr>
                    ))}
                  </tbody>
                </table>
             </div>

             {/* Mobile Card View */}
             <div className="md:hidden divide-y divide-slate-50 dark:divide-slate-800/50">
                {submissions.slice(0, 5).map((sub) => (
                  <div key={sub.id} className="p-4 space-y-3">
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200 tracking-tight">{sub.quizTitle}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col gap-0.5">
                         <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{new Date(sub.submittedAt).toLocaleDateString()}</p>
                         {quizzes.find(q => q.id === sub.quizId)?.deadline && (
                            <p className="text-[8px] font-black text-slate-300 dark:text-slate-700 uppercase tracking-tighter">
                               Due: {formatDeadline(quizzes.find(q => q.id === sub.quizId)!.deadline!)}
                            </p>
                         )}
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        <p className="text-sm font-black text-slate-900 dark:text-slate-100">{sub.score}</p>
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500">/ {sub.totalPoints}</p>
                      </div>
                    </div>
                  </div>
                ))}
             </div>
          </div>
        </section>
      )}
    </div>
  );
}
