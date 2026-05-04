import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, orderBy, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { Quiz } from '../types';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Search, BookOpen, Trash2, BarChart3, Settings, MoreVertical, Edit, Eye, EyeOff, ShieldCheck, Clock } from 'lucide-react';
import { cn, formatDeadline } from '../lib/utils';
import DeleteModal from './DeleteModal';

export default function TeacherAssessments() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [quizToDelete, setQuizToDelete] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!profile) return;

    const fetchQuizzes = async () => {
      try {
        const q = query(
          collection(db, 'quizzes'),
          where('teacherId', '==', profile.uid)
        );
        const snap = await getDocs(q);
        const quizList = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as Quiz))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setQuizzes(quizList);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchQuizzes();
  }, [profile]);

  const handleDelete = async () => {
    if (!quizToDelete || !profile) return;
    const quizId = quizToDelete;

    try {
      setIsDeleting(quizId);
      
      // 1. Purge all associated submissions and performance history
      const subQuery = query(
        collection(db, 'submissions'), 
        where('quizId', '==', quizId)
      );
      const subSnap = await getDocs(subQuery);
      
      if (!subSnap.empty) {
        const deletePromises = subSnap.docs.map(d => deleteDoc(doc(db, 'submissions', d.id)));
        await Promise.all(deletePromises);
      }

      // 2. Definitive removal of the Knowledge Module
      await deleteDoc(doc(db, 'quizzes', quizId));
      
      setQuizzes(quizzes.filter(q => q.id !== quizId));
      setQuizToDelete(null);
    } catch (error) {
      console.error("Deletion failed:", error);
      handleFirestoreError(error, OperationType.DELETE, `quizzes/${quizId}`);
    } finally {
      setIsDeleting(null);
    }
  };

  const toggleHide = async (quizId: string, currentHidden: boolean) => {
    try {
      await updateDoc(doc(db, 'quizzes', quizId), {
        isHidden: !currentHidden
      });
      setQuizzes(quizzes.map(q => 
        q.id === quizId ? { ...q, isHidden: !currentHidden } : q
      ));
    } catch (error) {
      console.error("Failed to toggle visibility:", error);
    }
  };

  const filteredQuizzes = quizzes.filter(q => 
    q.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="flex h-[60vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" /></div>;

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <header className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold font-display text-slate-800 dark:text-slate-100 tracking-tight">Assessment Inventory</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium tracking-tight">Manage and monitor your higher-order curriculum evaluation modules.</p>
        </div>
        <Link
          to="/teacher/create"
          className="flex items-center justify-center gap-3 rounded-xl bg-indigo-600 dark:bg-indigo-500 px-8 py-3.5 text-[11px] font-bold uppercase tracking-widest text-white transition-all hover:bg-indigo-700 dark:hover:bg-indigo-600 shadow-[0_10px_20px_rgba(79,70,229,0.15)] hover:shadow-[0_15px_30px_rgba(79,70,229,0.3)] active:scale-95 group"
        >
          <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" />
          Create New Module
        </Link>
      </header>

      <section className="space-y-8">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          <div className="col-span-full relative group">
            <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-slate-300 dark:text-slate-600 group-focus-within:text-indigo-400 transition-colors" />
            </div>
            <input
              type="text"
              placeholder="Filter inventory by module title, keywords, or educator identifier..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 py-5 pl-14 pr-6 text-sm font-medium text-slate-800 dark:text-slate-100 shadow-sm focus:border-indigo-100 dark:focus:border-indigo-900 focus:ring-4 focus:ring-indigo-600/5 outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600 placeholder:italic"
            />
          </div>

          <AnimatePresence>
            {filteredQuizzes.length === 0 ? (
              <div className="col-span-full py-24 text-center">
                <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100 dark:border-slate-800 opacity-20">
                  <BookOpen className="h-8 w-8 text-slate-400 dark:text-slate-500" />
                </div>
                <p className="text-slate-400 dark:text-slate-600 italic font-medium tracking-tight">No matching assessment modules discovered in your current inventory.</p>
              </div>
            ) : (
              filteredQuizzes.map((quiz, i) => (
                <motion.div
                  key={quiz.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.05 }}
                  className="group relative flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-[0_2px_8_rgba(0,0,0,0.04)] dark:shadow-none hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_20px_40px_rgba(0,0,0,0.3)] hover:-translate-y-2 hover:border-indigo-100 dark:hover:border-indigo-900 transition-all duration-300 overflow-hidden cursor-pointer"
                  onClick={() => navigate(`/teacher/quiz/${quiz.id}`)}
                >
                  {/* Subtle Top Gradient Bar */}
                  <div className={cn(
                    "h-1.5 w-full transition-colors",
                    quiz.isHidden ? "bg-amber-100 dark:bg-amber-900/30" : "bg-indigo-50 dark:bg-indigo-900/20 group-hover:bg-indigo-600 dark:group-hover:bg-indigo-500"
                  )} />
                  
                  <div className="p-7 flex-1 flex flex-col">
                    <div className="mb-6 flex items-start justify-between">
                      <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 shadow-sm border",
                        "bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 border-slate-100 dark:border-slate-800 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-500"
                      )}>
                        <BookOpen className="h-6 w-6" />
                      </div>
                      
                      <div className="flex gap-2">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleHide(quiz.id, !!quiz.isHidden);
                          }}
                          className={cn(
                            "p-2.5 rounded-xl transition-all shadow-sm border opacity-0 group-hover:opacity-100 active:scale-90",
                            quiz.isHidden ? "bg-amber-50 dark:bg-amber-900/20 text-amber-500 dark:text-amber-400 border-amber-100 dark:border-amber-800/50" : "bg-white dark:bg-slate-800 text-slate-300 dark:text-slate-600 hover:text-indigo-500 dark:hover:text-indigo-400 border-slate-100 dark:border-slate-700"
                          )}
                          title={quiz.isHidden ? "Show Module" : "Hide Module"}
                        >
                          {quiz.isHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/teacher/edit/${quiz.id}`);
                          }}
                          className="p-2.5 bg-white dark:bg-slate-800 text-slate-300 dark:text-slate-600 hover:text-indigo-500 dark:hover:text-indigo-400 border border-slate-100 dark:border-slate-700 rounded-xl transition-all shadow-sm opacity-0 group-hover:opacity-100 active:scale-90"
                          title="Configuration Settings"
                        >
                          <Settings className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setQuizToDelete(quiz.id);
                          }}
                          disabled={isDeleting === quiz.id}
                          className={cn(
                            "p-2.5 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl transition-all shadow-sm opacity-0 group-hover:opacity-100 active:scale-90",
                            isDeleting === quiz.id ? "text-slate-200 animate-pulse" : "text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400"
                          )}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-4 mb-6">
                      <h3 className="text-xl font-bold font-display text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors tracking-tight leading-tight">{quiz.title}</h3>
                      
                      <div className="flex flex-col gap-2.5">
                        <div className="flex items-center gap-2 group/educator cursor-help">
                          <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[7px] font-black text-slate-500 dark:text-slate-400 group-hover/educator:bg-indigo-100 group-hover/educator:text-indigo-600 transition-colors uppercase border border-slate-200/50 dark:border-slate-700/50">
                            {quiz.teacherName?.charAt(0) || 'E'}
                          </div>
                          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest italic group-hover/educator:text-slate-600 dark:group-hover/educator:text-slate-300 transition-colors">By {quiz.teacherName}</p>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                             <Clock className="h-3.5 w-3.5 text-slate-300 dark:text-slate-700" />
                             {quiz.questions.length} Items
                          </div>
                          <div className="text-[10px] font-black uppercase tracking-widest text-indigo-400 dark:text-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/10 px-2.5 py-0.5 rounded border border-indigo-100/50 dark:border-indigo-900/30">
                            Limit: {quiz.retakeLimit === 0 ? 'Unlimited' : `${quiz.retakeLimit} Attempt${quiz.retakeLimit === 1 ? '' : 's'}`}
                          </div>
                          
                          {quiz.deadline && (
                            <div className={cn(
                              "text-[9px] font-black uppercase tracking-tighter flex items-center gap-1 px-2 py-0.5 rounded-md",
                              new Date(quiz.deadline) < new Date() ? "bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 border border-red-100 dark:border-red-900/50 animate-pulse" : "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50"
                            )}>
                              <Clock className="w-2.5 h-2.5" />
                              {new Date(quiz.deadline) < new Date() ? "Expired" : formatDeadline(quiz.deadline)}
                            </div>
                          )}
                          
                          {quiz.isHidden && (
                            <span className="text-[9px] bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-md border border-amber-100 dark:border-amber-800/50 font-black uppercase tracking-tighter">Private</span>
                          )}
                          
                          <span className={cn(
                             "text-[9px] px-2 py-0.5 rounded-md border font-black uppercase tracking-tighter flex items-center gap-1",
                             quiz.isPublic 
                               ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800/50" 
                               : "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/50"
                          )}>
                             <ShieldCheck className="w-2.5 h-2.5" /> 
                             {quiz.isPublic ? 'Institutional' : `Secure: ${quiz.allowedStudentIds?.length || 0}`}
                          </span>
                        </div>
                      </div>
                    </div>

                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium line-clamp-2 italic leading-relaxed mb-auto">
                      {quiz.description || "Experimental instructional metadata for curriculum synchronization."}
                    </p>
                  </div>

                  <div className="px-7 py-5 bg-slate-50/30 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between group-hover:bg-indigo-50/20 dark:group-hover:bg-indigo-900/10 transition-all">
                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors">
                      <BarChart3 className="h-4 w-4" />
                      Analytical Matrix
                    </div>
                    <span className="text-[10px] font-bold text-slate-300 dark:text-slate-700">
                      Sync {new Date(quiz.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </section>

      <DeleteModal
        isOpen={!!quizToDelete}
        onClose={() => setQuizToDelete(null)}
        onConfirm={handleDelete}
        title="Purge Assessment"
        message="Are you sure you want to permanently delete this assessment? All student results and performance history for this specific module will be purged from the central database."
        isDeleting={!!isDeleting}
      />
    </div>
  );
}
