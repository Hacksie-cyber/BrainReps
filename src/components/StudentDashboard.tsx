import { useEffect, useState } from 'react';
import { collection, query, getDocs, orderBy, where, or, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { Quiz, QuizSubmission } from '../types';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, Trophy, Clock, Search, ArrowRight, CheckCircle2, History, ShieldAlert, AlertTriangle, X, Zap, Brain, Database, PieChart as PieIcon } from 'lucide-react';
import { cn, formatDeadline } from '../lib/utils';
import { studentCache } from '../lib/studentCache';
import { addLocalNotification, deleteLocalNotification } from '../lib/localNotifications';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

// Ranking Logic Component to avoid global collection listeners and handle permissions correctly
function QuizRankings({ quizId, currentStudentId }: { quizId: string, currentStudentId: string }) {
  const [stats, setStats] = useState<{ top1: QuizSubmission | null, myRank: number, total: number }>({ top1: null, myRank: 0, total: 0 });

  useEffect(() => {
    let active = true;
    const cacheKey = studentCache.generateKey('quiz-rankings', quizId, currentStudentId);
    
    // Check if we have a fresh cache entry (TTL: 3 minutes)
    const cachedData = studentCache.get<{ top1: QuizSubmission | null; myRank: number; total: number }>(cacheKey, 3 * 60 * 1000);
    if (cachedData) {
      setStats(cachedData);
      return;
    }

    const fetchRankings = async () => {
      try {
        const q = query(
          collection(db, 'submissions'),
          where('quizId', '==', quizId),
          where('status', '==', 'completed')
        );
        const snapshot = await getDocs(q);
        if (!active) return;

        const allSubs = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as QuizSubmission))
          .filter(s => {
            const role = (s.studentRole || 'student').toLowerCase();
            return role !== 'teacher' && role !== 'admin' && role !== 'educator' && role !== 'faculty';
          });
        
        const latestSubsMap = new Map<string, QuizSubmission>();
        allSubs.forEach(s => {
          const existing = latestSubsMap.get(s.studentId);
          if (!existing || s.score > existing.score) {
            latestSubsMap.set(s.studentId, s);
          }
        });
        
        const sortedSubs = Array.from(latestSubsMap.values()).sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          const timeA = a.timeTaken || 0;
          const timeB = b.timeTaken || 0;
          if (timeB !== timeA) return timeA - timeB;
          return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
        });

        const newStats = {
          top1: sortedSubs[0] || null,
          myRank: sortedSubs.findIndex(s => s.studentId === currentStudentId) + 1,
          total: sortedSubs.length
        };

        studentCache.set(cacheKey, newStats);
        if (active) {
          setStats(newStats);
        }
      } catch (error: any) {
        console.warn(`Ranking fetch failed for quiz ${quizId}:`, error.message);
      }
    };

    fetchRankings();

    return () => {
      active = false;
    };
  }, [quizId, currentStudentId]);

  return (
    <div className="mb-8 space-y-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800/50 transition-colors group-hover:bg-white dark:group-hover:bg-slate-800">
       <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
             <Trophy className="h-3.5 w-3.5 text-amber-500" />
             <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Top Achievement</span>
          </div>
          {stats.top1 ? (
            <p className="text-[10px] font-bold text-slate-700 dark:text-slate-200">{stats.top1.studentName} <span className="text-amber-500 ml-1">({stats.top1.score}pts)</span></p>
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
          {stats.myRank > 0 ? (
             <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-tighter">Rank #{stats.myRank} <span className="text-[8px] text-slate-400 font-bold ml-1">/ {stats.total}</span></p>
          ) : (
             <p className="text-[10px] font-medium text-slate-300 italic uppercase">Not Ranked</p>
          )}
       </div>
    </div>
  );
}

export default function StudentDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [submissions, setSubmissions] = useState<QuizSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);

  const [topAchiever, setTopAchiever] = useState<string | null>(null);
  const [globalRank, setGlobalRank] = useState<{ rank: number; total: number } | null>(null);

  useEffect(() => {
    if (!profile) return;
    let active = true;

    // 1. Fetch assessments (stale-while-revalidate pattern)
    const fetchQuizzes = async () => {
      const quizzesCacheKey = studentCache.generateKey('quizzes-list', profile.uid);
      const cachedQuizzes = studentCache.get<Quiz[]>(quizzesCacheKey, 5 * 60 * 1000);
      if (cachedQuizzes && active) {
        setQuizzes(cachedQuizzes);
      }

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
        
        studentCache.set(quizzesCacheKey, quizList);
        if (active) setQuizzes(quizList);
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
      if (active) {
        setSubmissions(subList);
        setLoading(false);
      }
    }, (error) => {
      console.error("User submissions sync failed:", error);
    });

    // 3. Get global rankings data targeting completed modules (cached: 5 mins TTL)
    const fetchGlobalRankings = async () => {
      const globalRankCacheKey = studentCache.generateKey('global-rankings', profile.uid);
      const cachedGlobal = studentCache.get<{ globalRank: { rank: number; total: number } | null; topAchiever: string | null }>(globalRankCacheKey, 5 * 60 * 1000);
      
      if (cachedGlobal) {
        if (active) {
          setGlobalRank(cachedGlobal.globalRank);
          setTopAchiever(cachedGlobal.topAchiever);
        }
        return;
      }

      try {
        const qAllSubs = query(
          collection(db, 'submissions'),
          where('status', '==', 'completed')
        );
        const snapshot = await getDocs(qAllSubs);
        if (!active) return;
        
        const allSubs = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as QuizSubmission))
          .filter(s => {
            const role = (s.studentRole || 'student').toLowerCase();
            return role !== 'teacher' && role !== 'admin' && role !== 'educator' && role !== 'faculty';
          });

        // Aggregation: Best score per module for each student
        const studentModuleBest = new Map<string, Map<string, number>>();
        const studentNames = new Map<string, string>();

        allSubs.forEach(s => {
          if (!studentModuleBest.has(s.studentId)) {
            studentModuleBest.set(s.studentId, new Map());
            studentNames.set(s.studentId, s.studentName);
          }
          const userMap = studentModuleBest.get(s.studentId)!;
          const currentBest = userMap.get(s.quizId) || 0;
          if (s.score > currentBest) userMap.set(s.quizId, s.score);
        });

        const rankingList = Array.from(studentModuleBest.entries()).map(([studentId, modules]) => {
          let total = 0;
          modules.forEach(score => total += score);
          return { studentId, name: studentNames.get(studentId) || "Anonymous", total };
        }).sort((a, b) => b.total - a.total);

        let myRank: { rank: number; total: number } | null = null;
        let topName: string | null = null;

        const myRankIndex = rankingList.findIndex(r => r.studentId === profile.uid);
        if (myRankIndex !== -1) {
          myRank = { rank: myRankIndex + 1, total: rankingList.length };
        }
        if (rankingList.length > 0) {
          topName = `${rankingList[0].name} (${rankingList[0].total}pts)`;
        }

        const dataToCache = { globalRank: myRank, topAchiever: topName };
        studentCache.set(globalRankCacheKey, dataToCache);

        if (active) {
          setGlobalRank(myRank);
          setTopAchiever(topName);
        }
      } catch (error) {
        console.warn("Global ranking calculation failed:", error);
      }
    };

    fetchQuizzes();
    fetchGlobalRankings();

    return () => {
      active = false;
      unsubUser();
    };
  }, [profile]);

  // 4. Daily Deadline Realtime Alert & Clean-up System
  useEffect(() => {
    if (!profile || quizzes.length === 0) return;

    const checkTodayDeadlines = () => {
      try {
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;

        for (const quiz of quizzes) {
          if (!quiz.deadline) continue;
          
          const qDate = new Date(quiz.deadline);
          const isDueToday = qDate.getDate() === today.getDate() &&
                             qDate.getMonth() === today.getMonth() &&
                             qDate.getFullYear() === today.getFullYear();

          const uniqueNotifId = `deadline-${quiz.id}-${profile.uid}-${todayStr}`;

          if (isDueToday) {
            const hasSubmitted = submissions.some(s => s.quizId === quiz.id);
            if (!hasSubmitted) {
              try {
                addLocalNotification(profile.uid, {
                  id: uniqueNotifId,
                  title: '⚡ Deadline Alert: Due Today!',
                  message: `The module "${quiz.title}" is due today at ${qDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Complete it now!`,
                  type: 'assignment',
                  relatedId: quiz.id
                });
              } catch (err) {
                console.error("Failed to write daily deadline notification to local storage:", err);
              }
            } else {
              // Clean up the alert if student has successfully completed/submitted
              try {
                deleteLocalNotification(profile.uid, uniqueNotifId);
              } catch (err) {
                console.warn("Failed to delete completed daily deadline notification from local storage:", err);
              }
            }
          }
        }
      } catch (err) {
        console.error("Deadline Alert System check failed:", err);
      }
    };

    checkTodayDeadlines();
  }, [profile, quizzes, submissions]);

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

  // Calculate performance breakdown for the donut chart based on all assigned quizzes
  const masteredCount = quizzes.filter(q => {
    const quizSubmissions = submissions.filter(s => s.quizId === q.id);
    if (quizSubmissions.length === 0) return false;
    const bestScorePercent = Math.max(...quizSubmissions.map(s => (s.score / s.totalPoints) * 100));
    return bestScorePercent >= 75;
  }).length;

  const passedCount = quizzes.filter(q => {
    const quizSubmissions = submissions.filter(s => s.quizId === q.id);
    if (quizSubmissions.length === 0) return false;
    const bestScorePercent = Math.max(...quizSubmissions.map(s => (s.score / s.totalPoints) * 100));
    return bestScorePercent >= 50 && bestScorePercent < 75;
  }).length;

  const reviewCount = quizzes.filter(q => {
    const quizSubmissions = submissions.filter(s => s.quizId === q.id);
    if (quizSubmissions.length === 0) return false;
    const bestScorePercent = Math.max(...quizSubmissions.map(s => (s.score / s.totalPoints) * 100));
    return bestScorePercent < 50;
  }).length;

  const unattemptedCount = quizzes.filter(q => {
    const quizSubmissions = submissions.filter(s => s.quizId === q.id);
    return quizSubmissions.length === 0;
  }).length;

  const totalInBreakdown = masteredCount + passedCount + reviewCount + unattemptedCount;

  const donutData = [
    { name: 'Mastered (≥75%)', value: masteredCount, color: '#10B981', hoverColor: '#059669', percentage: totalInBreakdown > 0 ? Math.round((masteredCount / totalInBreakdown) * 100) : 0 },
    { name: 'Passed (50-74%)', value: passedCount, color: '#6366F1', hoverColor: '#4F46E5', percentage: totalInBreakdown > 0 ? Math.round((passedCount / totalInBreakdown) * 100) : 0 },
    { name: 'Needs Review (<50%)', value: reviewCount, color: '#EF4444', hoverColor: '#DC2626', percentage: totalInBreakdown > 0 ? Math.round((reviewCount / totalInBreakdown) * 100) : 0 },
    { name: 'Unattempted', value: unattemptedCount, color: '#64748B', hoverColor: '#475569', percentage: totalInBreakdown > 0 ? Math.round((unattemptedCount / totalInBreakdown) * 100) : 0 },
  ];

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
      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <div className="bg-white dark:bg-slate-900 p-7 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-all hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] group">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Modules Mastered</p>
            <CheckCircle2 className="h-4 w-4 text-emerald-500 group-hover:scale-110 transition-transform" />
          </div>
          <div className="flex items-baseline gap-2">
            <h3 className="text-4xl font-bold font-display text-slate-900 dark:text-slate-50 leading-none">{stats.completed}</h3>
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">+{stats.thisWeek} this week</span>
          </div>
        </div>
        
        <div className="bg-white dark:bg-slate-900 p-7 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-[0_2px_8_px_rgba(0,0,0,0.04)] transition-all hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] group">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-3">Mastery Coefficient</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-4xl font-bold font-display text-slate-900 dark:text-slate-50 leading-none">{stats.avgScore}%</h3>
          </div>
          <div className="mt-4 w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div className="bg-indigo-600 h-full transition-all duration-1000 ease-out shadow-[0_0_8px_rgba(79,70,229,0.4)]" style={{ width: `${stats.avgScore}%` }}></div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-7 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-[0_2px_8_px_rgba(0,0,0,0.04)] transition-all hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] group">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Institutional Rank</p>
            <div className="w-5 h-5 rounded bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-black text-[10px]">#</div>
          </div>
          <div className="flex items-baseline gap-2">
            <h3 className="text-4xl font-bold font-display text-slate-900 dark:text-slate-50 leading-none">
              {globalRank ? `#${globalRank.rank}` : "---"}
            </h3>
            {globalRank && (
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">/ {globalRank.total}</span>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-7 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-[0_2px_8_px_rgba(0,0,0,0.04)] transition-all hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] group flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Top Achievement</p>
            <Trophy className="h-4 w-4 text-amber-500 group-hover:scale-110 transition-transform shrink-0" />
          </div>
          <div className="w-full">
            <h3 className="text-base sm:text-lg lg:text-xl font-black font-display text-slate-900 dark:text-slate-50 leading-snug uppercase break-words" title={topAchiever || undefined}>
              {topAchiever || "---"}
            </h3>
            <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest mt-1.5">Institutional Peak</p>
          </div>
        </div>
        
        <div className="bg-white dark:bg-slate-900 p-7 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-[0_2px_8_px_rgba(0,0,0,0.04)] transition-all hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] group">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Record Score</p>
            <Zap className="h-4 w-4 text-indigo-500 group-hover:scale-110 transition-transform" />
          </div>
          <div className="flex items-baseline gap-2">
            <h3 className="text-4xl font-bold font-display text-slate-900 dark:text-slate-50 leading-none">{stats.topScore}%</h3>
          </div>
        </div>
      </section>

      {/* Curriculum Performance Breakdown (Donut Graph Section) */}
      <section className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-all hover:shadow-[0_20px_40px_rgba(0,0,0,0.06)]">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
          
          {/* Left Text Detail */}
          <div className="flex-1 space-y-4 w-full text-center lg:text-left">
            <div className="flex items-center justify-center lg:justify-start gap-3">
              <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl text-indigo-600 dark:text-indigo-400 border border-indigo-100/50 dark:border-indigo-900/30">
                <PieIcon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">Curriculum Mastery Breakdown</h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium tracking-tight">Real-time completion distribution across your assigned modules</p>
              </div>
            </div>

            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-medium italic max-w-lg mx-auto lg:mx-0">
              Your overall progress indicates that you have successfully mastered <span className="text-emerald-500 font-bold">{masteredCount}</span> of your <span className="text-slate-700 dark:text-slate-200 font-bold">{quizzes.length}</span> assigned subjects. Complete outstanding unattempted assignments to improve your institutional standings.
            </p>

            {/* Custom Interactive Legend Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-3 pt-2">
              {donutData.map((item) => (
                <div 
                  key={item.name} 
                  className="p-3 rounded-xl border border-slate-100/40 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-800/20 text-left transition-all hover:bg-slate-50 dark:hover:bg-slate-800/40 relative overflow-hidden group/item"
                >
                  <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: item.color }} />
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{item.name.split(' (')[0]}</p>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-lg font-black text-slate-700 dark:text-slate-200">{item.value} <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">mod</span></span>
                    <span className="text-xs font-black" style={{ color: item.color }}>{item.percentage}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Visual Donut Chart */}
          <div className="w-full lg:w-[320px] shrink-0 flex flex-col items-center justify-center relative">
            <div className="w-[280px] h-[220px] relative flex items-center justify-center">
              
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-900 dark:bg-slate-950 text-white p-3 rounded-xl shadow-xl text-center border border-slate-800/50 text-xs font-bold leading-none space-y-1.5 animate-in zoom-in-95 duration-100">
                            <p className="uppercase tracking-wide text-[10px] text-slate-400">{data.name}</p>
                            <p className="text-sm font-black text-white">{data.value} {data.value === 1 ? 'Module' : 'Modules'}</p>
                            <p className="text-[10px] text-indigo-300 font-medium">({data.percentage}% of overall)</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={88}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {donutData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.color} 
                        className="transition-all duration-300 hover:opacity-90 outline-none cursor-pointer"
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>

              {/* Absolute Central Counter inside the Donut hole */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-3xl font-black font-display tracking-tight text-slate-800 dark:text-slate-50 leading-none">
                  {masteredCount}<span className="text-sm font-bold text-slate-400 dark:text-slate-600"> / {totalInBreakdown}</span>
                </span>
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mt-1">
                  Mastered
                </span>
              </div>
            </div>

            {/* Quick Status Bar */}
            <div className="w-full flex justify-center gap-4 text-[10px] font-extrabold uppercase tracking-wide text-slate-400 mt-2">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Done
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#64748B]" />
                Incomplete
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* Brain AI Assistant Section */}
      <section className="bg-indigo-600 rounded-2xl p-8 text-white shadow-xl shadow-indigo-600/20 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl group-hover:scale-110 transition-transform duration-700" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="max-w-xl space-y-4 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-4">
              <div className="p-3 bg-white/20 rounded-xl">
                <Brain className="h-6 w-6 text-white" />
              </div>
              <h2 className="text-2xl font-black font-display tracking-tight uppercase italic underline decoration-white/30 underline-offset-8">Neural Assistant</h2>
            </div>
            <p className="text-indigo-100 font-medium leading-relaxed italic">
              Synchronize with our grounded neural model. Ask questions about your handouts, subject matter, and academic materials.
            </p>
          </div>
          <Link
            to="/student/assistant"
            className="inline-flex items-center justify-center gap-3 bg-white text-indigo-600 px-8 py-4 rounded-xl font-black text-xs uppercase tracking-[0.2em] shadow-lg shadow-black/10 hover:bg-slate-50 transition-all active:scale-95 group/btn shrink-0"
          >
            Launch Neural Core
            <ArrowRight className="h-4 w-4 group-hover/btn:translate-x-1 transition-transform" />
          </Link>
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
              const extraAllowed = quiz.extraAttempts?.[profile?.uid || ''] || 0;
              const totalLimit = (quiz.retakeLimit || 1) + extraAllowed;
              const limitReached = !isUnlimited && userSubs.length >= totalLimit;

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
                           <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400 text-emerald-700 text-[10px] rounded-full border border-emerald-100 dark:border-emerald-900/30 font-bold uppercase tracking-widest shadow-sm">
                              <CheckCircle2 className="h-3 w-3" />
                              Attempted
                           </div>
                           <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 font-display">
                              {Math.round((submission.score / submission.totalPoints) * 100)}%
                           </span>
                         </div>
                       )}
                       <span className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-[0.1em] bg-slate-50 dark:bg-slate-800/50 px-2.5 py-1 rounded border border-slate-100 dark:border-slate-800">
                          {isUnlimited ? 'Unlimited' : `Attempts: ${userSubs.length} / ${totalLimit}`}
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
                  <QuizRankings quizId={quiz.id} currentStudentId={profile?.uid || ''} />
                  
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
                        className="flex items-center gap-2 rounded-xl bg-slate-50 dark:bg-slate-800 px-5 py-2.5 text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 border border-slate-200 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-900 transition-all shadow-sm"
                      >
                        Review
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    ) : quiz.deadline && new Date(quiz.deadline) < new Date() ? (
                      <div className="px-5 py-2.5 bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-600 font-bold text-[11px] uppercase tracking-widest rounded-xl border border-slate-200 dark:border-slate-700 opacity-60 flex items-center gap-2">
                        Expired
                      </div>
                    ) : (
                      <button
                        onClick={() => setSelectedQuizId(quiz.id)}
                        className="flex items-center gap-2 rounded-xl bg-indigo-600 dark:bg-indigo-700 px-6 py-3 text-[11px] font-bold uppercase tracking-widest text-white shadow-[0_10px_20px_rgba(79,70,229,0.15)] hover:shadow-[0_15px_30px_rgba(79,70,229,0.3)] hover:bg-indigo-700 transition-all active:scale-95 group/btn"
                      >
                        {submission ? 'Retake Test' : 'Take Test'}
                        <ArrowRight className="h-4 w-4 transform group-hover/btn:translate-x-0.5 transition-transform" />
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })
          )}
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
