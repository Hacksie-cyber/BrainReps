import { useEffect, useState } from 'react';
import { collection, query, getDocs, orderBy, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { Quiz, QuizSubmission } from '../types';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { BookOpen, Trophy, Clock, Search, ArrowRight, CheckCircle2, History } from 'lucide-react';
import { cn } from '../lib/utils';

export default function StudentDashboard() {
  const { profile } = useAuth();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [submissions, setSubmissions] = useState<QuizSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!profile) return;

    const fetchData = async () => {
      try {
        const quizSnap = await getDocs(query(collection(db, 'quizzes')));
        const quizList = quizSnap.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as Quiz))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setQuizzes(quizList);

        const subSnap = await getDocs(query(
          collection(db, 'submissions'),
          where('studentId', '==', profile.uid)
        ));
        const subList = subSnap.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as QuizSubmission))
          .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
        setSubmissions(subList);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
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

  if (loading) return <div className="flex h-[60vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Active Learning Dashboard</h1>
          <p className="text-sm text-slate-500 font-medium">Review your progress and explore upcoming assessments.</p>
        </div>
      </header>

      {/* Stats Overview */}
      <section className="grid gap-6 sm:grid-cols-3">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 group">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Completed</p>
            <CheckCircle2 className="h-4 w-4 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="flex items-baseline gap-2">
            <h3 className="text-3xl font-bold text-slate-900">{stats.completed}</h3>
            <span className="text-[10px] font-bold text-emerald-600">+{stats.thisWeek} this week</span>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Academic Score</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-3xl font-bold text-slate-900">{stats.avgScore}%</h3>
          </div>
          <div className="mt-3 w-full bg-slate-100 h-1 rounded-full overflow-hidden">
            <div className="bg-indigo-600 h-full transition-all duration-1000" style={{ width: `${stats.avgScore}%` }}></div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Peak Performance</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-3xl font-bold text-slate-900">{stats.topScore}%</h3>
            <Trophy className="h-4 w-4 text-amber-500" />
          </div>
        </div>
      </section>

      {/* Quiz Discovery */}
      <section className="space-y-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <h2 className="flex items-center gap-2 font-bold text-slate-800">
            <Search className="h-4 w-4 text-slate-400" />
            Find Assessment
          </h2>
          <div className="relative w-full md:w-80">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by topic or educator..."
              className="w-full rounded-lg bg-slate-50 border border-slate-100 py-2.5 pl-4 pr-10 text-xs focus:bg-white focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600/20 outline-none transition-all font-medium"
            />
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredQuizzes.length === 0 ? (
            <div className="col-span-full py-12 text-center text-slate-400 italic font-medium tracking-tight">No learning modules matched your query.</div>
          ) : (
            filteredQuizzes.map((quiz, i) => {
              const submission = submissions.find(s => s.quizId === quiz.id);
              return (
                <motion.div
                  key={quiz.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="group relative flex flex-col bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-lg transition-all hover:border-indigo-200"
                >
                  <div className="mb-4 flex items-start justify-between">
                    <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                      <BookOpen className="h-5 w-5" />
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      {submission && (
                         <div className="flex flex-col items-end gap-1">
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] rounded border border-emerald-100 font-bold uppercase tracking-tight">Attempted</span>
                            <span className="text-[10px] font-black text-indigo-600">Achievement: {Math.round((submission.score / submission.totalPoints) * 100)}%</span>
                         </div>
                      )}
                      <span className="text-[8px] font-black uppercase text-slate-400 tracking-tighter">
                        {profile?.role === 'teacher' || quiz.retakeLimit === 0 ? 'Unlimited' : `Attempts: ${submissions.filter(s => s.quizId === quiz.id).length} / ${quiz.retakeLimit || 1}`}
                      </span>
                    </div>
                  </div>
                  
                  <h3 className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors tracking-tight">{quiz.title}</h3>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">Educator: {quiz.teacherName}</p>
                  
                  <p className="text-xs text-slate-500 mb-6 font-medium leading-relaxed italic line-clamp-2">
                    {quiz.description || "No overview provided for this module."}
                  </p>
                  
                  <div className="mt-auto flex items-center justify-between pt-4 border-t border-slate-50">
                    <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                       <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {quiz.questions.length} Items
                       </span>
                    </div>

                    {profile?.role === 'student' && quiz.retakeLimit !== 0 && submissions.filter(s => s.quizId === quiz.id).length >= (quiz.retakeLimit || 1) ? (
                      <Link
                        to="/student/performance"
                        className="text-[11px] font-bold text-slate-400 hover:text-indigo-600 transition-colors"
                      >
                        Review Achievement
                      </Link>
                    ) : (
                      <Link
                        to={`/student/quiz/${quiz.id}`}
                        className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-[11px] font-bold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all hover:translate-x-1"
                      >
                        {submission ? 'Retry' : 'Launch Assessment'}
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
          <h2 className="flex items-center gap-2 font-bold text-slate-800">
            <History className="h-4 w-4 text-slate-400" />
            Academic Transcripts
          </h2>
          <div className="rounded-xl bg-white border border-slate-200 overflow-hidden shadow-sm">
             {/* Desktop Table View */}
             <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50/50 border-b border-slate-100">
                    <tr className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        <th className="px-6 py-3">Assessment</th>
                        <th className="px-6 py-3 text-center">Submission Date</th>
                        <th className="px-6 py-3 text-right">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {submissions.slice(0, 5).map((sub) => (
                        <tr key={sub.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4">
                              <p className="text-sm font-bold text-slate-700 tracking-tight">{sub.quizTitle}</p>
                          </td>
                          <td className="px-6 py-4 text-center">
                              <p className="text-[11px] font-bold text-slate-400 uppercase">{new Date(sub.submittedAt).toLocaleDateString()}</p>
                          </td>
                          <td className="px-6 py-4 text-right">
                              <div className="flex flex-col items-end">
                                <p className="text-sm font-bold text-slate-900">{sub.score} / {sub.totalPoints}</p>
                                <div className="mt-1.5 h-1 w-20 bg-slate-100 rounded-full overflow-hidden">
                                    <div 
                                      className={cn("h-full transition-all duration-1000", (sub.score / sub.totalPoints) >= 0.7 ? "bg-indigo-600" : "bg-indigo-200")} 
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
             <div className="md:hidden divide-y divide-slate-50">
                {submissions.slice(0, 5).map((sub) => (
                  <div key={sub.id} className="p-4 space-y-3">
                    <p className="text-sm font-bold text-slate-700 tracking-tight line-clamp-1">{sub.quizTitle}</p>
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{new Date(sub.submittedAt).toLocaleDateString()}</p>
                      <div className="flex items-baseline gap-1.5">
                        <p className="text-sm font-black text-slate-900">{sub.score}</p>
                        <p className="text-[10px] font-bold text-slate-400">/ {sub.totalPoints}</p>
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
