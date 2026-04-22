import { useEffect, useState } from 'react';
import { collection, query, getDocs, orderBy, where, or } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { Quiz, QuizSubmission } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, Search, CheckCircle2, Clock, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn, formatDeadline } from '../lib/utils';

export default function StudentQuizzes() {
  const { profile } = useAuth();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [submissions, setSubmissions] = useState<QuizSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [searchTerm, setSearchTerm] = useState('');

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

  if (loading) return <div className="flex h-[60vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Curriculum Modules</h1>
          <p className="text-sm text-slate-500 font-medium">Browse and engage with assigned learning assessments.</p>
        </div>
        <div className="flex bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
          {(['all', 'pending', 'completed'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-4 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all",
                filter === f ? "bg-indigo-600 text-white shadow-md" : "text-slate-400 hover:text-slate-600"
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </header>

      <section className="space-y-6">
        <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center gap-3 shadow-sm">
          <Search className="h-5 w-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search curricula by title or educator..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-medium text-slate-600 placeholder:text-slate-300 italic"
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
                    className="group relative flex flex-col bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-indigo-200 transition-all"
                  >
                    <div className="mb-4 flex items-start justify-between">
                      <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                        <BookOpen className="h-5 w-5" />
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        {isCompleted && (
                           <div className="flex flex-col items-end gap-1">
                             <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[9px] rounded border border-emerald-100 font-black uppercase tracking-tighter shadow-sm">
                                <CheckCircle2 className="h-3 w-3" />
                                {limitReached ? 'Finalized' : 'Attempted'}
                             </div>
                             {latestSubmission && (
                               <div className="flex flex-col items-end">
                                 <span className="text-[10px] font-black text-indigo-600">
                                   Score: {latestSubmission.score} / {latestSubmission.totalPoints}
                                 </span>
                                 <span className="text-[9px] font-bold text-slate-400">
                                   Achievement: {Math.round((latestSubmission.score / latestSubmission.totalPoints) * 100)}%
                                 </span>
                               </div>
                             )}
                           </div>
                        )}
                        <span className="text-[8px] font-black uppercase text-slate-400 tracking-tighter">
                          {profile?.role === 'teacher' || isUnlimitedQuiz ? 'Unlimited Attempts' : `Attempts: ${userSubmissions.length} / ${quiz.retakeLimit || 1}`}
                        </span>
                      </div>
                    </div>
                    
                    <h3 className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors tracking-tight line-clamp-1">{quiz.title}</h3>
                    <div className="flex flex-col gap-1 mb-4">
                      <div className="flex items-center gap-2 group/educator cursor-help" title={`Curriculum designed by ${quiz.teacherName}`}>
                         <div className="w-4 h-4 rounded-full bg-slate-100 flex items-center justify-center text-[7px] font-black text-slate-400 group-hover/educator:bg-indigo-100 group-hover/educator:text-indigo-600 transition-colors uppercase">
                            {quiz.teacherName?.charAt(0) || 'E'}
                         </div>
                         <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 group-hover/educator:text-slate-600 transition-colors">Educator: {quiz.teacherName}</p>
                      </div>
                      {quiz.deadline && (
                        <p className={cn(
                          "text-[9px] font-black uppercase tracking-tighter flex items-center gap-1",
                          new Date(quiz.deadline) < new Date() ? "text-red-500 animate-pulse" : "text-indigo-500/70"
                        )}>
                          <Clock className="h-2.5 w-2.5" />
                          Deadline: {formatDeadline(quiz.deadline)}
                          {new Date(quiz.deadline) < new Date() && " (EXPIRED)"}
                        </p>
                      )}
                    </div>
                    
                    <p className="text-xs text-slate-500 mb-6 font-medium leading-relaxed italic line-clamp-2">
                       {quiz.description || "Instructional module for structural logic evaluation."}
                    </p>
                    
                    <div className="mt-auto flex items-center justify-between pt-4 border-t border-slate-50">
                      <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                         <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {quiz.questions.length} Items
                         </span>
                      </div>

                      {limitReached ? (
                        <Link
                          to="/student/performance"
                          className="flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 hover:bg-white border border-transparent hover:border-indigo-100 transition-all"
                        >
                          Review Result
                        </Link>
                      ) : quiz.deadline && new Date(quiz.deadline) < new Date() ? (
                        <div className="px-4 py-2 bg-slate-100 text-slate-400 font-black text-[10px] uppercase tracking-widest rounded-lg border border-slate-200 opacity-60">
                          Expired
                        </div>
                      ) : (
                        <Link
                          to={`/student/quiz/${quiz.id}`}
                          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all active:scale-95"
                        >
                          {isCompleted ? 'Retry' : 'Access'}
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>
      </section>
    </div>
  );
}
