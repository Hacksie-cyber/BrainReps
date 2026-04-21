import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, orderBy, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { Quiz } from '../types';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Search, BookOpen, Trash2, BarChart3, Settings, MoreVertical, Edit, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { cn } from '../lib/utils';
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
      console.error(error);
      alert('Deletion failed: Database link interrupted.');
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
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Assessment Inventory</h1>
          <p className="text-sm text-slate-500 font-medium tracking-tight">Manage and monitor your curriculum evaluation modules.</p>
        </div>
        <Link
          to="/teacher/create"
          className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white transition-all hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 active:scale-95"
        >
          <Plus className="h-4 w-4" />
          New Assessment
        </Link>
      </header>

      <section className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="col-span-full bg-white p-4 rounded-xl border border-slate-200 flex items-center gap-3 shadow-sm">
            <Search className="h-5 w-5 text-slate-400" />
            <input
              type="text"
              placeholder="Filter inventory by module title or keywords..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-medium text-slate-600 placeholder:text-slate-300 italic"
            />
          </div>

          <AnimatePresence>
            {filteredQuizzes.length === 0 ? (
              <div className="col-span-full py-20 text-center text-slate-300 italic font-medium">
                <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-10" />
                No matching assessment modules found.
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
                  className="group relative bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all flex flex-col cursor-pointer"
                  onClick={() => navigate(`/teacher/quiz/${quiz.id}`)}
                >
                  <div className="p-6 space-y-4">
                    <div className="flex justify-between items-start">
                      <div className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center",
                        "bg-slate-50 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors"
                      )}>
                        <BookOpen className="h-5 w-5" />
                      </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleHide(quiz.id, !!quiz.isHidden);
                            }}
                            className={cn(
                              "p-1.5 rounded-md transition-all opacity-0 group-hover:opacity-100",
                              quiz.isHidden ? "text-amber-500 hover:bg-amber-50" : "text-slate-300 hover:text-indigo-500 hover:bg-indigo-50"
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
                            className="p-1.5 text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 rounded-md transition-all opacity-0 group-hover:opacity-100"
                            title="Edit Module"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setQuizToDelete(quiz.id);
                          }}
                          disabled={isDeleting === quiz.id}
                          className={cn(
                            "p-1.5 rounded-md transition-all opacity-0 group-hover:opacity-100",
                            isDeleting === quiz.id ? "text-slate-200 animate-pulse" : "text-slate-300 hover:text-red-500 hover:bg-red-50"
                          )}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-bold text-slate-800 text-lg group-hover:text-indigo-600 transition-colors tracking-tight">{quiz.title}</h3>
                      <div className="flex gap-3 mt-1 items-center">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          {quiz.questions.length} Questions
                        </p>
                        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400 border-l border-slate-200 pl-3">
                          Limit: {quiz.retakeLimit === 0 ? 'Unlimited' : `${quiz.retakeLimit} ${quiz.retakeLimit === 1 ? 'Attempt' : 'Attempts'}`}
                        </p>
                        {quiz.isHidden && (
                          <span className="text-[9px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-100 font-bold uppercase tracking-tighter">Hidden</span>
                        )}
                        {quiz.isPublic ? (
                          <span className="text-[9px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-100 font-bold uppercase tracking-tighter flex items-center gap-1">
                            <ShieldCheck className="w-2.5 h-2.5" /> Global
                          </span>
                        ) : (
                          quiz.allowedStudentIds && quiz.allowedStudentIds.length > 0 && (
                            <span className="text-[9px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-100 font-bold uppercase tracking-tighter flex items-center gap-1">
                              <ShieldCheck className="w-2.5 h-2.5" /> {quiz.allowedStudentIds.length} Restricted
                            </span>
                          )
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-slate-500 font-medium line-clamp-2 italic leading-relaxed">
                      {quiz.description || "Instructional metadata not specified for this module."}
                    </p>
                  </div>

                  <div className="mt-auto px-6 py-4 bg-slate-50/50 border-t border-slate-100 rounded-b-xl flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                      <BarChart3 className="h-3 w-3" />
                      View Analytics
                    </div>
                    <span className="text-[10px] font-bold text-slate-300">
                      Created {new Date(quiz.createdAt).toLocaleDateString()}
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
