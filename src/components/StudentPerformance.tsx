import { useEffect, useState } from 'react';
import { collection, query, onSnapshot, orderBy, where, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { Quiz, QuizSubmission } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Trophy, Target, TrendingUp, Calendar, BookOpen, Shield, Zap, Award, Eye, EyeOff, CheckCircle2, XCircle, X, Lock, KeyRound, AlertTriangle, ShieldAlert } from 'lucide-react';
import { cn, formatDeadline } from '../lib/utils';
import { studentCache } from '../lib/studentCache';

export default function StudentPerformance() {
  const { profile } = useAuth();
  const [submissions, setSubmissions] = useState<QuizSubmission[]>([]);
  const [quizzes, setQuizzes] = useState<Record<string, Quiz>>({});
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(5);

  const [showRestrictionModal, setShowRestrictionModal] = useState(false);
  const [restrictedQuiz, setRestrictedQuiz] = useState<Quiz | null>(null);
  const [selectedSubForReview, setSelectedSubForReview] = useState<QuizSubmission | null>(null);

  useEffect(() => {
    if (!profile) return;
    let active = true;

    // Use onSnapshot for real-time updates to ensure the latest submissions appear instantly
    const q = query(
      collection(db, 'submissions'),
      where('studentId', '==', profile.uid)
    );

    const unsubscribe = onSnapshot(q, async (subSnap) => {
      try {
        const subList = subSnap.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as QuizSubmission))
          // Sort by submittedAt string or serverTimestamp if available
          .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
        
        if (active) setSubmissions(subList);

        // Fetch related quizzes to show question texts and teacher names (using cached lookup)
        const quizIds = Array.from(new Set(subList.map(s => s.quizId)));
        const quizMap: Record<string, Quiz> = { ...quizzes };
        let updated = false;

        await Promise.all(quizIds.map(async (qId) => {
          const cacheKey = studentCache.generateKey('quiz-detail', qId);
          let cachedQuiz = studentCache.get<Quiz>(cacheKey, 10 * 60 * 1000); // 10 minutes TTL
          
          if (!cachedQuiz) {
            const qSnap = await getDoc(doc(db, 'quizzes', qId));
            if (qSnap.exists()) {
              cachedQuiz = { id: qSnap.id, ...qSnap.data() } as Quiz;
              studentCache.set(cacheKey, cachedQuiz);
            }
          }

          if (cachedQuiz && !quizMap[qId]) {
            quizMap[qId] = cachedQuiz;
            updated = true;
          }
        }));
        
        if (updated && active) {
          setQuizzes(quizMap);
        }
      } catch (error) {
        console.error("Error processing submissions:", error);
      } finally {
        if (active) setLoading(false);
      }
    }, (error) => {
      console.error("Listener failed:", error);
      if (active) setLoading(false);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [profile?.uid]);

  const handleSubmissionClick = (sub: QuizSubmission) => {
    const quiz = quizzes[sub.quizId];
    if (quiz?.showAnswerKey) {
      setSelectedSubForReview(sub);
    } else {
      setRestrictedQuiz(quiz || null);
      setShowRestrictionModal(true);
    }
  };

  if (loading) return <div className="flex h-[60vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" /></div>;

  const modulesBestScores: Record<string, number> = {};
  submissions.forEach(s => {
    const percent = (s.score / s.totalPoints);
    if (!modulesBestScores[s.quizId] || percent > modulesBestScores[s.quizId]) {
      modulesBestScores[s.quizId] = percent;
    }
  });

  const masteredCount = Object.values(modulesBestScores).filter(p => p >= 0.75).length;

  const stats = {
    completed: masteredCount,
    avgScore: submissions.length > 0
      ? Math.round((submissions.reduce((acc, curr) => acc + (curr.score / curr.totalPoints), 0) / submissions.length) * 100)
      : 0,
    topScore: submissions.length > 0
      ? Math.max(...submissions.map(s => Math.round((s.score / s.totalPoints) * 100)))
      : 0,
    totalPoints: submissions.reduce((acc, curr) => acc + curr.score, 0)
  };

  const chartData = [...submissions].reverse().map(s => ({
    name: s.quizTitle,
    score: Math.round((s.score / s.totalPoints) * 100)
  }));

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <header>
        <h1 className="text-3xl font-bold font-display text-slate-900 dark:text-slate-100 tracking-tight">Academic Performance</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Metrical analysis of your learning trajectory and achievement scores.</p>
      </header>

      <section className="grid gap-6 md:grid-cols-4">
        {[
          { label: 'Avg Achievement', value: `${stats.avgScore}%`, icon: Target, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50/50 dark:bg-indigo-900/20' },
          { label: 'Modules Mastered', value: stats.completed, icon: Zap, color: 'text-amber-500 dark:text-amber-400', bg: 'bg-amber-50/50 dark:bg-amber-900/20' },
          { label: 'Record High', value: `${stats.topScore}%`, icon: Trophy, color: 'text-emerald-500 dark:text-emerald-400', bg: 'bg-emerald-50/50 dark:bg-emerald-900/20' },
          { label: 'Total Credits', value: stats.totalPoints, icon: Award, color: 'text-blue-500 dark:text-blue-400', bg: 'bg-blue-50/50 dark:bg-blue-900/20' },
        ].map((stat, i) => (
          <div key={i} className="bg-white dark:bg-slate-900 p-7 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] transition-all group">
            <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center mb-5 transition-transform group-hover:scale-110", stat.bg)}>
              <stat.icon className={cn("h-6 w-6", stat.color)} />
            </div>
            <p className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-[0.2em] mb-1">{stat.label}</p>
            <h3 className="text-3xl font-bold font-display text-slate-900 dark:text-slate-100 leading-none">{stat.value}</h3>
          </div>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-8">
          <h3 className="text-sm font-bold font-display text-slate-900 dark:text-slate-100 flex items-center gap-2 uppercase tracking-widest">
            <TrendingUp className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
            Progression Timeline
          </h3>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" hide />
                <YAxis hide domain={[0, 100]} />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '16px', 
                    border: 'none', 
                    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
                    backgroundColor: 'var(--tw-slate-900)',
                    color: '#f8fafc'
                  }}
                  itemStyle={{ color: '#f8fafc' }}
                  cursor={{ fill: 'rgba(241, 245, 249, 0.05)' }}
                />
                <Bar dataKey="score" radius={[6, 6, 0, 0]} barSize={40}>
                   {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.score >= 75 ? '#4f46e5' : entry.score >= 50 ? '#818cf8' : '#64748b'} />
                   ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col items-center justify-center text-center space-y-8 relative overflow-hidden group">
           <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <Award className="w-24 h-24 text-indigo-600 dark:text-indigo-400 rotate-12" />
           </div>
           <div className="w-28 h-28 rounded-full border-[6px] border-slate-50 dark:border-slate-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-inner relative overflow-hidden ring-1 ring-slate-100 dark:ring-slate-800">
              <div 
                className="absolute bottom-0 left-0 w-full bg-indigo-50 dark:bg-indigo-900/20 transition-all duration-1000 ease-out" 
                style={{ height: `${stats.avgScore}%` }}
              />
              <span className="relative z-10 text-3xl font-black font-display">{stats.avgScore}%</span>
           </div>
           <div className="relative z-10">
              <h4 className="font-bold font-display text-slate-900 dark:text-slate-100 tracking-tight">Mastery Coefficient</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium italic mt-2 px-6 leading-relaxed">Your ranking is formulated through multi-variable assessment metrics across all curriculum headers.</p>
           </div>
        </div>
      </div>

      <section className="space-y-6">
        <h2 className="text-xl font-bold font-display text-slate-900 dark:text-slate-100 tracking-tight">Recent Activity Log</h2>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden">
           {/* Desktop view */}
           <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50/50 dark:bg-slate-800/30 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800">
                    <th className="px-8 py-5">Assessment Title</th>
                    <th className="px-8 py-5 text-center">Standing</th>
                    <th className="px-8 py-5">Submited Date</th>
                    <th className="px-8 py-5 text-center">Reference Deadline</th>
                    <th className="px-8 py-5 text-right">Metric</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                  {submissions.slice(0, visibleCount).map((sub) => (
                    <tr 
                      key={sub.id} 
                      className="group cursor-pointer hover:bg-slate-50/40 dark:hover:bg-slate-800/30 transition-colors"
                      onClick={() => handleSubmissionClick(sub)}
                    >
                      <td className="px-8 py-6">
                         <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-slate-50 dark:bg-slate-800 rounded-lg flex items-center justify-center text-slate-300 dark:text-slate-600 transition-colors">
                               <BookOpen className="h-5 w-5" />
                            </div>
                            <div>
                               <div className="flex items-center gap-2">
                                 <p className="font-bold text-slate-800 dark:text-slate-200 tracking-tight text-base">{sub.quizTitle}</p>
                                 {quizzes[sub.quizId]?.showAnswerKey ? (
                                   <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800/60">
                                     <Eye className="w-2.5 h-2.5 text-purple-600 dark:text-purple-400" /> Key Available
                                   </span>
                                 ) : (
                                   <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700">
                                     <EyeOff className="w-2.5 h-2.5" /> Key Sealed
                                   </span>
                                 )}
                               </div>
                               <div className="flex items-center gap-2 mt-1">
                                 <div className="w-4 h-4 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[7px] font-black text-slate-400 dark:text-slate-600 uppercase">
                                   {quizzes[sub.quizId]?.teacherName?.charAt(0) || 'E'}
                                 </div>
                                 <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 tracking-tight">By {quizzes[sub.quizId]?.teacherName || "Assigned Faculty"}</p>
                               </div>
                            </div>
                         </div>
                      </td>
                      <td className="px-8 py-6 text-center">
                         {(sub as any).rank ? (
                            <div className="inline-flex flex-col items-center">
                               <span className="text-sm font-black text-slate-900 dark:text-white">Rank #{(sub as any).rank}</span>
                               <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">out of {(sub as any).totalParticipants || "?"}</span>
                            </div>
                         ) : (
                            <span className="text-[9px] font-bold text-slate-300 italic">No Rank</span>
                         )}
                      </td>
                      <td className="px-8 py-6">
                         <div className="flex items-center gap-2 text-xs font-bold text-slate-400 dark:text-slate-500">
                            <Calendar className="h-3.5 w-3.5" />
                            {new Date(sub.submittedAt).toLocaleDateString()}
                         </div>
                      </td>
                      <td className="px-8 py-6 text-center">
                         {quizzes[sub.quizId]?.deadline ? (
                            <div className="inline-flex flex-col items-center px-3 py-1 bg-slate-50 dark:bg-slate-800 rounded-md border border-slate-100 dark:border-slate-700">
                               <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tighter">
                                  {formatDeadline(quizzes[sub.quizId].deadline!)}
                               </p>
                               {new Date(quizzes[sub.quizId].deadline!) < new Date(sub.submittedAt) && (
                                  <span className="text-[7px] font-black text-red-400 dark:text-red-500 uppercase tracking-widest mt-0.5">Retardate</span>
                               )}
                            </div>
                         ) : (
                            <span className="text-[9px] text-slate-300 dark:text-slate-700 uppercase font-bold tracking-widest italic">Open Access</span>
                         )}
                      </td>
                      <td className="px-8 py-6 text-right">
                         <div className="flex flex-col items-end">
                           <span className={cn(
                               "text-lg font-black font-display leading-none",
                               (sub.score/sub.totalPoints) >= 0.75 ? "text-indigo-600 dark:text-indigo-400" : "text-amber-500 dark:text-amber-400"
                            )}>
                              {sub.score} / {sub.totalPoints}
                           </span>
                           <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mt-1">
                              {Math.round((sub.score/sub.totalPoints) * 100)}% Performance
                           </span>
                         </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
           </div>

           {/* Mobile view */}
           <div className="md:hidden divide-y divide-slate-50 dark:divide-slate-800/50">
              {submissions.slice(0, visibleCount).map((sub) => (
                <button
                  key={sub.id}
                  onClick={() => handleSubmissionClick(sub)}
                  className="w-full p-6 flex flex-col gap-4 text-left hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors"
                >
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <p className="font-bold text-slate-900 dark:text-slate-200 tracking-tight text-base leading-tight">{sub.quizTitle}</p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Educator: {quizzes[sub.quizId]?.teacherName || "Assigned Faculty"}</p>
                        {quizzes[sub.quizId]?.showAnswerKey ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-wider bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800/60">
                            <Eye className="w-2 h-2 text-purple-600" /> Key Available
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700">
                            <EyeOff className="w-2 h-2" /> Key Sealed
                          </span>
                        )}
                      </div>
                      {(sub as any).rank && (
                        <div className="flex items-center gap-1.5 mt-2 px-2 py-0.5 bg-slate-50 dark:bg-slate-800 rounded border border-slate-100 dark:border-slate-700 w-fit">
                          <Trophy className="w-2.5 h-2.5 text-amber-500" />
                          <span className="text-[9px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-tighter">Rank #{(sub as any).rank}</span>
                        </div>
                      )}
                    </div>
                    <span className={cn(
                      "text-xl font-black font-display shrink-0",
                      (sub.score/sub.totalPoints) >= 0.75 ? "text-indigo-600 dark:text-indigo-400" : "text-amber-500 dark:text-amber-400"
                    )}>
                      {sub.score}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-50 dark:border-slate-800">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                      <Calendar className="h-3 w-3" />
                      {new Date(sub.submittedAt).toLocaleDateString()}
                    </div>
                    <div className="text-[10px] font-black text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                      {Math.round((sub.score/sub.totalPoints) * 100)}%
                    </div>
                  </div>
                </button>
            ))}
           </div>

           {submissions.length > visibleCount && (
             <div className="p-4 bg-slate-50/50 dark:bg-slate-800/20 border-t border-slate-100 dark:border-slate-800/50 text-center">
               <button
                 id="btn-show-more-activities"
                 onClick={() => setVisibleCount(prev => prev + 5)}
                 className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-500 dark:hover:bg-indigo-600 rounded-xl font-bold text-xs tracking-tight transition-all active:scale-95 shadow-md shadow-indigo-600/10 hover:shadow-lg hover:shadow-indigo-600/20"
               >
                 Show More Activities
               </button>
             </div>
           )}
        </div>
      </section>

      {/* Answer Key Sealed Notice Modal */}
      <AnimatePresence>
        {showRestrictionModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowRestrictionModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800"
            >
              <div className="p-8 text-center space-y-6">
                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto ring-8 ring-slate-200/50 dark:ring-slate-700/50">
                  <Lock className="h-8 w-8 text-slate-500 dark:text-slate-400" />
                </div>
                
                <div className="space-y-3">
                  <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Answer Key Sealed</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
                    Instructor <strong className="text-slate-900 dark:text-slate-100">{restrictedQuiz?.teacherName || "Assigned Faculty"}</strong> has hidden the answer key for this assessment to preserve academic integrity.
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 italic bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                    Your final score and recorded responses have been officially verified and archived.
                  </p>
                </div>

                <div className="pt-2">
                  <button 
                    onClick={() => setShowRestrictionModal(false)}
                    className="w-full py-4 bg-indigo-600 hover:bg-slate-900 dark:hover:bg-white dark:hover:text-slate-900 text-white rounded-2xl font-bold tracking-tight transition-all active:scale-95 shadow-xl shadow-indigo-600/20"
                  >
                    Acknowledged
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Answer Key & Performance Review Modal (When Permitted by Educator) */}
      <AnimatePresence>
        {selectedSubForReview && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedSubForReview(null)}
              className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-3xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col z-10"
            >
              {/* Header */}
              <div className="p-6 md:p-8 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-4 bg-slate-50/50 dark:bg-slate-900/50">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800 flex items-center gap-1">
                      <Eye className="w-3 h-3 text-purple-600 dark:text-purple-400" /> Answer Key Released
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">
                      {new Date(selectedSubForReview.submittedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                    {selectedSubForReview.quizTitle}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Instructor: {quizzes[selectedSubForReview.quizId]?.teacherName || 'Assigned Faculty'}
                  </p>
                </div>
                <button 
                  onClick={() => setSelectedSubForReview(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Score Summary Banner */}
              <div className="px-6 md:px-8 py-4 bg-indigo-50/50 dark:bg-indigo-950/20 border-b border-indigo-100/50 dark:border-indigo-900/30 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black">
                    <Target className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Your Score</p>
                    <p className="text-lg font-black text-indigo-600 dark:text-indigo-400">
                      {selectedSubForReview.score} / {selectedSubForReview.totalPoints} points
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-bold ml-2">
                        ({Math.round((selectedSubForReview.score / selectedSubForReview.totalPoints) * 100)}%)
                      </span>
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1 justify-end">
                    <KeyRound className="w-3.5 h-3.5" /> Verified Key
                  </span>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">Authorized by Instructor</p>
                </div>
              </div>

              {/* Questions & Solutions List */}
              <div className="p-6 md:p-8 overflow-y-auto space-y-6 flex-1 divide-y divide-slate-100 dark:divide-slate-800">
                {(quizzes[selectedSubForReview.quizId]?.questions || []).map((q, qIndex) => {
                  const resp = selectedSubForReview.responses?.find(r => r.questionId === q.id);
                  const studentAns = resp?.answer || '';
                  const earned = resp?.pointsEarned ?? (studentAns.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase() ? q.points : 0);
                  const isCorrect = earned > 0;

                  return (
                    <div key={q.id} className="pt-6 first:pt-0 space-y-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-black flex items-center justify-center">
                            {qIndex + 1}
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            {q.type.replace('-', ' ')}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "text-xs font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 border",
                            isCorrect 
                              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                              : "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800"
                          )}>
                            {isCorrect ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                            {earned} / {q.points} pts
                          </span>
                        </div>
                      </div>

                      <h4 className="text-sm md:text-base font-bold text-slate-800 dark:text-slate-200">
                        {q.question}
                      </h4>

                      {/* Multiple Choice Review */}
                      {q.type === 'multiple-choice' && q.options && (
                        <div className="grid gap-2 pt-2">
                          {q.options.map((opt, optIdx) => {
                            const isAnswerKey = String(optIdx) === q.correctAnswer.trim() || opt.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase();
                            const isStudentChoice = String(optIdx) === studentAns.trim() || opt.trim().toLowerCase() === studentAns.trim().toLowerCase();

                            return (
                              <div
                                key={optIdx}
                                className={cn(
                                  "p-3 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all",
                                  isAnswerKey && isStudentChoice && "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200",
                                  isAnswerKey && !isStudentChoice && "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300",
                                  !isAnswerKey && isStudentChoice && "bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-800 text-red-900 dark:text-red-200",
                                  !isAnswerKey && !isStudentChoice && "bg-slate-50/50 dark:bg-slate-800/30 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                                )}
                              >
                                <div className="flex items-center gap-3">
                                  <span className={cn(
                                    "w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black uppercase",
                                    isAnswerKey ? "bg-emerald-600 text-white" : (isStudentChoice ? "bg-red-500 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300")
                                  )}>
                                    {String.fromCharCode(65 + optIdx)}
                                  </span>
                                  <span>{opt}</span>
                                </div>

                                <div className="flex items-center gap-2">
                                  {isStudentChoice && (
                                    <span className={cn(
                                      "text-[9px] font-black uppercase px-2 py-0.5 rounded",
                                      isCorrect ? "bg-emerald-200 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-200" : "bg-red-200 dark:bg-red-900 text-red-800 dark:text-red-200"
                                    )}>
                                      Your Answer
                                    </span>
                                  )}
                                  {isAnswerKey && (
                                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-emerald-600 text-white flex items-center gap-1 shadow-sm">
                                      <CheckCircle2 className="w-2.5 h-2.5" /> Correct Key
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* True / False Review */}
                      {q.type === 'true-false' && (
                        <div className="grid grid-cols-2 gap-3 pt-2">
                          {['true', 'false'].map((val) => {
                            const isAnswerKey = q.correctAnswer.toLowerCase() === val;
                            const isStudentChoice = studentAns.toLowerCase() === val;

                            return (
                              <div
                                key={val}
                                className={cn(
                                  "p-3 rounded-xl border text-xs font-bold flex items-center justify-between capitalize",
                                  isAnswerKey && "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200",
                                  !isAnswerKey && isStudentChoice && "bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-800 text-red-900 dark:text-red-200",
                                  !isAnswerKey && !isStudentChoice && "bg-slate-50 dark:bg-slate-800/30 border-slate-100 dark:border-slate-800 text-slate-500"
                                )}
                              >
                                <span>{val}</span>
                                <div className="flex items-center gap-1">
                                  {isStudentChoice && (
                                    <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700">
                                      You
                                    </span>
                                  )}
                                  {isAnswerKey && (
                                    <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-600 text-white flex items-center gap-1">
                                      <CheckCircle2 className="w-2.5 h-2.5" /> Key
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Short Answer Review */}
                      {q.type === 'short-answer' && (
                        <div className="space-y-2 pt-2">
                          <div className={cn(
                            "p-3 rounded-xl border text-xs font-medium flex items-center justify-between",
                            isCorrect 
                              ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-300"
                              : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800/50 text-red-800 dark:text-red-300"
                          )}>
                            <span>Your Answer: <strong>{studentAns || '(Empty)'}</strong></span>
                            {isCorrect ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <XCircle className="w-4 h-4 text-red-500" />}
                          </div>
                          
                          <div className="p-3 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 text-xs font-semibold flex items-center justify-between">
                            <span className="flex items-center gap-2">
                              <KeyRound className="w-4 h-4 text-emerald-600" />
                              <span>Verified Answer Key: <strong>{q.correctAnswer}</strong></span>
                            </span>
                            <span className="text-[9px] font-black uppercase bg-emerald-600 text-white px-2 py-0.5 rounded">
                              Official Solution
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Modal Footer */}
              <div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <button
                  onClick={() => setSelectedSubForReview(null)}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95"
                >
                  Close Review
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
