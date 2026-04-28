import { useEffect, useState } from 'react';
import { collection, query, onSnapshot, orderBy, where, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { Quiz, QuizSubmission } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Trophy, Target, TrendingUp, Calendar, BookOpen, Shield, Zap, Award } from 'lucide-react';
import { cn, formatDeadline } from '../lib/utils';

export default function StudentPerformance() {
  const { profile } = useAuth();
  const [submissions, setSubmissions] = useState<QuizSubmission[]>([]);
  const [quizzes, setQuizzes] = useState<Record<string, Quiz>>({});
  const [loading, setLoading] = useState(true);

  const [showRestrictionModal, setShowRestrictionModal] = useState(false);

  useEffect(() => {
    if (!profile) return;

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
        
        setSubmissions(subList);

        // Fetch related quizzes to show question texts and teacher names
        const quizIds = Array.from(new Set(subList.map(s => s.quizId)));
        const newQuizIds = quizIds.filter(id => !quizzes[id]);
        
        if (newQuizIds.length > 0) {
          const quizMap: Record<string, Quiz> = { ...quizzes };
          await Promise.all(newQuizIds.map(async (qId) => {
            const qSnap = await getDoc(doc(db, 'quizzes', qId));
            if (qSnap.exists()) {
              quizMap[qId] = { id: qSnap.id, ...qSnap.data() } as Quiz;
            }
          }));
          setQuizzes(quizMap);
        }
      } catch (error) {
        console.error("Error processing submissions:", error);
      } finally {
        setLoading(false);
      }
    }, (error) => {
      console.error("Listener failed:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile?.uid]);

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
                    <th className="px-8 py-5">Submited Date</th>
                    <th className="px-8 py-5 text-center">Reference Deadline</th>
                    <th className="px-8 py-5 text-right">Metric</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                  {submissions.map((sub) => (
                    <tr 
                      key={sub.id} 
                      className="group cursor-pointer hover:bg-slate-50/30 dark:hover:bg-slate-800/20 transition-colors"
                      onClick={() => setShowRestrictionModal(true)}
                    >
                      <td className="px-8 py-6">
                         <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-slate-50 dark:bg-slate-800 rounded-lg flex items-center justify-center text-slate-300 dark:text-slate-600 transition-colors">
                               <BookOpen className="h-5 w-5" />
                            </div>
                            <div>
                               <p className="font-bold text-slate-800 dark:text-slate-200 tracking-tight text-base">{sub.quizTitle}</p>
                               <div className="flex items-center gap-2 mt-1">
                                 <div className="w-4 h-4 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[7px] font-black text-slate-400 dark:text-slate-600 uppercase">
                                   {quizzes[sub.quizId]?.teacherName?.charAt(0) || 'E'}
                                 </div>
                                 <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 tracking-tight">By {quizzes[sub.quizId]?.teacherName || "Assigned Faculty"}</p>
                               </div>
                            </div>
                         </div>
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
              {submissions.map((sub) => (
                <button
                  key={sub.id}
                  onClick={() => setShowRestrictionModal(true)}
                  className="w-full p-6 flex flex-col gap-4 text-left hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors"
                >
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <p className="font-bold text-slate-900 dark:text-slate-200 tracking-tight text-base leading-tight">{sub.quizTitle}</p>
                      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mt-1">Educator: {quizzes[sub.quizId]?.teacherName || "Assigned Faculty"}</p>
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
        </div>
      </section>

      {/* Restriction Notice Modal */}
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
                <div className="w-16 h-16 bg-amber-50 dark:bg-amber-900/20 rounded-full flex items-center justify-center mx-auto ring-8 ring-amber-500/10">
                  <Shield className="h-8 w-8 text-amber-500" />
                </div>
                
                <div className="space-y-3">
                  <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Access Restricted</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-bold leading-relaxed">
                    Due to answer key leakage, Educators decided to not to show answer key and responses anymore. Contact your educators for clarification.
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
    </div>
  );
}
