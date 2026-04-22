import { useEffect, useState } from 'react';
import { collection, query, getDocs, orderBy, where, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { Quiz, QuizSubmission, Question } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Trophy, Target, TrendingUp, Calendar, ArrowRight, Award, Zap, Info, X, CheckCircle2 } from 'lucide-react';
import { cn, formatDeadline } from '../lib/utils';

export default function StudentPerformance() {
  const { profile } = useAuth();
  const [submissions, setSubmissions] = useState<QuizSubmission[]>([]);
  const [quizzes, setQuizzes] = useState<Record<string, Quiz>>({});
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState<QuizSubmission | null>(null);

  useEffect(() => {
    if (!profile) return;

    const fetchData = async () => {
      try {
        const subSnap = await getDocs(query(
          collection(db, 'submissions'),
          where('studentId', '==', profile.uid)
        ));
        const subList = subSnap.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as QuizSubmission))
          .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
        setSubmissions(subList);

        // Fetch related quizzes to show question texts in breakdown
        const quizIds = Array.from(new Set(subList.map(s => s.quizId)));
        const quizMap: Record<string, Quiz> = {};
        
        await Promise.all(quizIds.map(async (qId) => {
          const qSnap = await getDoc(doc(db, 'quizzes', qId));
          if (qSnap.exists()) {
            quizMap[qId] = { id: qSnap.id, ...qSnap.data() } as Quiz;
          }
        }));
        setQuizzes(quizMap);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [profile]);

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

  const getQuestion = (quizId: string, qId: string): Question | undefined => {
    return quizzes[quizId]?.questions.find(q => q.id === qId);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <header>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Academic Performance</h1>
        <p className="text-sm text-slate-500 font-medium">Metrical analysis of your learning trajectory and achievement scores.</p>
      </header>

      <section className="grid gap-6 md:grid-cols-4">
        {[
          { label: 'Avg Achievement', value: `${stats.avgScore}%`, icon: Target, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Modules Mastered', value: stats.completed, icon: Zap, color: 'text-amber-500', bg: 'bg-amber-50' },
          { label: 'Record High', value: `${stats.topScore}%`, icon: Trophy, color: 'text-emerald-500', bg: 'bg-emerald-50' },
          { label: 'Total Credits', value: stats.totalPoints, icon: Award, color: 'text-blue-500', bg: 'bg-blue-50' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center mb-4", stat.bg)}>
              <stat.icon className={cn("h-5 w-5", stat.color)} />
            </div>
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">{stat.label}</p>
            <h3 className="text-2xl font-bold text-slate-800">{stat.value}</h3>
          </div>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 bg-white p-8 rounded-xl border border-slate-200 shadow-sm space-y-6">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-indigo-500" />
            Progression Timeline
          </h3>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" hide />
                <YAxis hide domain={[0, 100]} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  cursor={{ fill: '#f8fafc' }}
                />
                <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                   {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.score >= 70 ? '#4f46e5' : '#cbd5e1'} />
                   ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center space-y-6">
           <div className="w-20 h-20 rounded-full border-4 border-slate-50 flex items-center justify-center text-indigo-600 shadow-inner relative overflow-hidden">
              <div 
                className="absolute bottom-0 left-0 w-full bg-indigo-50 transition-all duration-1000" 
                style={{ height: `${stats.avgScore}%` }}
              />
              <span className="relative z-10 text-2xl font-black">{stats.avgScore}%</span>
           </div>
           <div>
              <h4 className="font-bold text-slate-800">Mastery Coefficient</h4>
              <p className="text-xs text-slate-500 font-medium italic mt-1 px-4 leading-relaxed">Your current standing is based on verified assessment metrics across all curriculum headers.</p>
           </div>
        </div>
      </div>

      <section className="space-y-6">
        <h2 className="text-lg font-bold text-slate-800 tracking-tight">Recent Activity Log</h2>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden text-left">
           {/* Desktop view */}
           <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <th className="px-8 py-4">Assessment Module</th>
                    <th className="px-8 py-4">Completion Date</th>
                    <th className="px-8 py-4 text-center">Deadline</th>
                    <th className="px-8 py-4 text-right">Metric</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {submissions.map((sub) => (
                    <tr 
                      key={sub.id} 
                      className="group cursor-pointer hover:bg-slate-50/50 transition-colors"
                      onClick={() => setSelectedSubmission(sub)}
                    >
                      <td className="px-8 py-5">
                         <div className="flex items-center gap-3">
                            <div>
                               <p className="font-bold text-slate-700 tracking-tight">{sub.quizTitle}</p>
                               <div className="flex items-center gap-1.5 mt-0.5">
                                 <div className="w-3 h-3 rounded-full bg-slate-100 flex items-center justify-center text-[5px] font-black text-slate-400 uppercase">
                                   {quizzes[sub.quizId]?.teacherName?.charAt(0) || 'E'}
                                 </div>
                                 <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Educator: {quizzes[sub.quizId]?.teacherName || "Assigned Faculty"}</p>
                               </div>
                            </div>
                            <Info className="h-3.5 w-3.5 text-slate-200 group-hover:text-indigo-400 transition-colors" />
                         </div>
                      </td>
                      <td className="px-8 py-5">
                         <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                            <Calendar className="h-3.5 w-3.5" />
                            {new Date(sub.submittedAt).toLocaleDateString()}
                         </div>
                      </td>
                      <td className="px-8 py-5 text-center">
                         {quizzes[sub.quizId]?.deadline ? (
                            <div className="flex flex-col items-center">
                               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                                  {formatDeadline(quizzes[sub.quizId].deadline!)}
                               </p>
                               {new Date(quizzes[sub.quizId].deadline!) < new Date(sub.submittedAt) && (
                                  <span className="text-[7px] font-black text-amber-500 uppercase">Late Submission</span>
                               )}
                            </div>
                         ) : (
                            <span className="text-[10px] text-slate-200 uppercase font-black">N/A</span>
                         )}
                      </td>
                      <td className="px-8 py-5 text-right">
                         <span className={cn(
                            "text-sm font-black",
                            (sub.score/sub.totalPoints) >= 0.7 ? "text-indigo-600" : "text-amber-500"
                         )}>
                            {sub.score} / {sub.totalPoints}
                         </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
           </div>

           {/* Mobile view */}
           <div className="md:hidden divide-y divide-slate-50">
              {submissions.map((sub) => (
                <button
                  key={sub.id}
                  onClick={() => setSelectedSubmission(sub)}
                  className="w-full p-4 flex flex-col gap-2 hover:bg-slate-50/50 transition-colors"
                >
                  <div className="flex justify-between items-start gap-4">
                    <p className="font-bold text-slate-700 tracking-tight text-left leading-snug">{sub.quizTitle}</p>
                    <span className={cn(
                      "text-sm font-black shrink-0",
                      (sub.score/sub.totalPoints) >= 0.7 ? "text-indigo-600" : "text-amber-500"
                    )}>
                      {sub.score} / {sub.totalPoints}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      <Calendar className="h-3 w-3" />
                      {new Date(sub.submittedAt).toLocaleDateString()}
                    </div>
                    {quizzes[sub.quizId]?.deadline && (
                      <div className="text-[9px] font-black text-slate-300 uppercase tracking-tighter">
                         Due: {formatDeadline(quizzes[sub.quizId].deadline!)}
                      </div>
                    )}
                  </div>
                </button>
              ))}
           </div>
        </div>
      </section>

      {/* Breakdown Modal */}
      <AnimatePresence>
        {selectedSubmission && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedSubmission(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <header className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h3 className="text-xl font-bold text-slate-800 tracking-tight">{selectedSubmission.quizTitle}</h3>
                  <p className="text-xs text-slate-500 font-medium">Educator: {quizzes[selectedSubmission.quizId]?.teacherName || "Assigned Faculty"} • Score: {selectedSubmission.score} / {selectedSubmission.totalPoints}</p>
                </div>
                <button 
                  onClick={() => setSelectedSubmission(null)}
                  className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400"
                >
                  <X className="h-5 w-5" />
                </button>
              </header>

              <div className="p-8 overflow-y-auto space-y-8">
                {selectedSubmission.responses.map((res, idx) => {
                  const q = getQuestion(selectedSubmission.quizId, res.questionId);
                  if (!q) return null;
                  
                  return (
                    <div key={idx} className="space-y-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Question {idx + 1}</span>
                          <h4 className="font-bold text-slate-800 leading-snug">{q.question}</h4>
                        </div>
                        <div className="text-right">
                          <p className={cn(
                            "text-lg font-black",
                            res.pointsEarned === res.maxPoints ? "text-emerald-500" : res.pointsEarned > 0 ? "text-amber-500" : "text-slate-300"
                          )}>
                            {res.pointsEarned} <span className="text-[10px] text-slate-300">/ {res.maxPoints}</span>
                          </p>
                        </div>
                      </div>

                      <div className="bg-slate-50 rounded-xl p-5 border border-slate-100 space-y-3">
                        <div className="space-y-1">
                          <p className="text-[9px] font-bold uppercase text-slate-400">Your Response</p>
                          <p className={cn(
                            "text-sm font-medium italic",
                            res.pointsEarned === res.maxPoints ? "text-emerald-700" : "text-slate-700"
                          )}>
                            {q.type === 'multiple-choice' && q.options && !isNaN(parseInt(res.answer)) 
                              ? `"${q.options[parseInt(res.answer)] || res.answer}"`
                              : `"${res.answer || "No response provided"}"`}
                          </p>
                        </div>
                        <div className="space-y-1 pt-2 border-t border-slate-100">
                           <p className="text-[9px] font-bold uppercase text-slate-400">Correct Answer / Reference</p>
                           <p className="text-sm font-bold text-indigo-600">
                             {q.type === 'multiple-choice' && q.options && !isNaN(parseInt(q.correctAnswer))
                               ? q.options[parseInt(q.correctAnswer)]
                               : q.correctAnswer}
                           </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
