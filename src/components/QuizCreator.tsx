import { useState, useEffect } from 'react';
import { collection, addDoc, doc, getDoc, updateDoc, deleteDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { Quiz, Question, QuestionType } from '../types';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Save, Plus, Trash2, ArrowLeft, GripVertical, CheckCircle2, Settings, Clock } from 'lucide-react';
import DeleteModal from './DeleteModal';

export default function QuizCreator() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [retakeLimit, setRetakeLimit] = useState(1);
  const [timeLimit, setTimeLimit] = useState(0);
  const [isUnlimited, setIsUnlimited] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isFetching, setIsFetching] = useState(false);

  useEffect(() => {
    if (!id) return;

    const fetchQuiz = async () => {
      try {
        setIsFetching(true);
        const docRef = doc(db, 'quizzes', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as Quiz;
          setTitle(data.title);
          setDescription(data.description);
          setQuestions(data.questions);
          setTimeLimit(data.timeLimit || 0);
          // If 0, treat as unlimited
          if (data.retakeLimit === 0) {
            setIsUnlimited(true);
            setRetakeLimit(1);
          } else {
            setRetakeLimit(data.retakeLimit || 1);
            setIsUnlimited(false);
          }
        }
      } catch (error) {
        console.error(error);
      } finally {
        setIsFetching(false);
      }
    };

    fetchQuiz();
  }, [id]);

  const addQuestion = (type: QuestionType) => {
    const newQuestion: Question = {
      id: crypto.randomUUID(),
      type,
      question: '',
      points: 1,
      correctAnswer: type === 'true-false' ? 'true' : '',
    };
    if (type === 'multiple-choice') {
      newQuestion.options = ['', '', '', ''];
    }
    setQuestions([...questions, newQuestion]);
  };

  const removeQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id));
  };

  const updateQuestion = (id: string, updates: Partial<Question>) => {
    setQuestions(questions.map(q => q.id === id ? { ...q, ...updates } : q));
  };

  const updateOption = (qId: string, optIndex: number, value: string) => {
    setQuestions(questions.map(q => {
      if (q.id === qId && q.options) {
        const newOptions = [...q.options];
        newOptions[optIndex] = value;
        return { ...q, options: newOptions };
      }
      return q;
    }));
  };

  const handleSave = async () => {
    if (!profile || !title || questions.length === 0) return;
    
    try {
      setLoading(true);
      const quizData = {
        title,
        description,
        teacherId: profile.uid,
        teacherName: profile.name,
        questions,
        retakeLimit: isUnlimited ? 0 : retakeLimit,
        timeLimit,
        updatedAt: new Date().toISOString()
      };
      
      if (id) {
        await updateDoc(doc(db, 'quizzes', id), quizData);
      } else {
        await addDoc(collection(db, 'quizzes'), {
          ...quizData,
          createdAt: new Date().toISOString()
        });
      }
      
      navigate('/teacher/assessments');
    } catch (error) {
      console.error(error);
      alert("Failed to save module configurations.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;

    try {
      setIsDeleting(true);
      
      // 1. Delete associated submissions
      const subQuery = query(
        collection(db, 'submissions'), 
        where('quizId', '==', id),
        where('teacherId', '==', profile.uid)
      );
      const subSnap = await getDocs(subQuery);
      const deletePromises = subSnap.docs.map(d => deleteDoc(doc(db, 'submissions', d.id)));
      await Promise.all(deletePromises);

      // 2. Delete the quiz
      await deleteDoc(doc(db, 'quizzes', id));
      
      navigate('/teacher/assessments');
    } catch (error) {
      console.error(error);
      alert('Delete failed.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/teacher/assessments')} className="p-2 border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors text-slate-400">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
               {id ? 'Refine Assessment' : 'New Knowledge Module'}
            </h1>
            <p className="text-sm text-slate-500 font-medium">Design and configure evaluation parameters.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {id && (
            <button
              onClick={() => setShowDeleteModal(true)}
              disabled={loading || isDeleting}
              className="p-2.5 text-red-500 hover:bg-red-50 rounded-lg transition-all border border-transparent hover:border-red-100 disabled:opacity-50"
              title="Delete Assessment"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={loading || isFetching || isDeleting || !title || questions.length === 0}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-bold text-sm transition-all hover:bg-indigo-700 disabled:opacity-50 shadow-lg shadow-indigo-600/20"
          >
            <Save className="w-4 h-4" />
            {loading ? 'Processing...' : (id ? 'Save Changes' : 'Finalize & Publish')}
          </button>
        </div>
      </header>

      <section className="space-y-8">
        <div className="bg-white rounded-xl p-8 shadow-sm border border-slate-200 space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Questionnaire Heading</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Economics Mid-Term Phase 1"
              className="w-full text-2xl font-bold tracking-tight border-b-2 border-slate-100 focus:border-indigo-500 focus:outline-none py-2 transition-all placeholder:text-slate-200"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Executive Summary</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide a high-level overview of the assessment goals..."
              className="w-full text-sm text-slate-600 border-none focus:ring-0 p-0 resize-none h-16 placeholder:text-slate-200 font-medium leading-relaxed italic"
            />
          </div>
          <div className="pt-6 border-t border-slate-50">
            <div className="space-y-4">
               <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4 text-indigo-500" />
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Retake Configuration</label>
               </div>
               
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <input
                      type="number"
                      min="1"
                      max="99"
                      disabled={isUnlimited}
                      value={retakeLimit}
                      onChange={(e) => setRetakeLimit(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-16 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                    />
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-tight">Standard Attempts</span>
                  </div>

                  <div className="flex items-center gap-3 px-4">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isUnlimited}
                        onChange={(e) => setIsUnlimited(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                      <span className="ms-3 text-xs font-bold text-slate-600 uppercase tracking-tight">Unlimited Retakes</span>
                    </label>
                  </div>
               </div>

               <div className="pt-4 space-y-4">
                 <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-indigo-500" />
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Strategic Time Limit</label>
                 </div>
                 
                 <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100 max-w-[280px]">
                    <input
                      type="number"
                      min="0"
                      max="480"
                      value={timeLimit}
                      onChange={(e) => setTimeLimit(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-16 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:border-indigo-500"
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-tight">Minutes Duration</span>
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Set to 0 for unlimited time</span>
                    </div>
                  </div>
               </div>
               <p className="text-[10px] font-medium text-slate-400 italic">
                 Note: Educators always retain absolute review privileges with unlimited attempts.
               </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <AnimatePresence>
            {questions.map((q, index) => (
              <motion.div
                key={q.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="group relative bg-white rounded-xl p-8 shadow-sm border border-slate-200"
              >
                <div className="absolute left-6 top-8 text-slate-200 group-hover:text-indigo-200 transition-colors pointer-events-none">
                  <div className="w-8 h-8 rounded bg-slate-50 flex items-center justify-center text-xs font-bold text-slate-400">
                    {index + 1}
                  </div>
                </div>

                <div className="ml-12 space-y-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                         <span className="px-2 py-0.5 bg-slate-50 text-slate-500 rounded border border-slate-100 text-[9px] font-black uppercase tracking-tighter">
                            {q.type.replace('-', ' ')}
                         </span>
                         <span className="text-[10px] font-bold text-slate-300">ID: {q.id.split('-')[0]}</span>
                      </div>
                      <input
                        type="text"
                        value={q.question}
                        onChange={(e) => updateQuestion(q.id, { question: e.target.value })}
                        placeholder="Enter strategic question content..."
                        className="w-full text-lg font-bold border-none focus:ring-0 p-0 text-slate-800 placeholder:text-slate-200"
                      />
                    </div>
                    <button onClick={() => removeQuestion(q.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors hover:bg-red-50 rounded-lg">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {q.type === 'multiple-choice' && q.options && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {q.options.map((opt, optIdx) => (
                        <div key={optIdx} className="flex items-center gap-3 bg-slate-50 p-2 rounded-lg border border-slate-100 focus-within:border-indigo-200 transition-all">
                          <button
                            onClick={() => updateQuestion(q.id, { correctAnswer: optIdx.toString() })}
                            className={`h-5 w-5 flex-shrink-0 rounded-full border-2 transition-all flex items-center justify-center ${
                              q.correctAnswer === optIdx.toString() ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'border-slate-300 bg-white'
                            }`}
                          >
                            {q.correctAnswer === optIdx.toString() && <CheckCircle2 className="h-3 w-3" />}
                          </button>
                          <input
                            type="text"
                            value={opt}
                            onChange={(e) => updateOption(q.id, optIdx, e.target.value)}
                            placeholder={`Variable Option ${optIdx + 1}`}
                            className="w-full bg-transparent border-none focus:ring-0 p-0 text-xs font-bold text-slate-600 placeholder:text-slate-300 italic"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {q.type === 'true-false' && (
                    <div className="flex gap-3">
                      {['true', 'false'].map((val) => (
                        <button
                          key={val}
                          onClick={() => updateQuestion(q.id, { correctAnswer: val })}
                          className={`flex-1 rounded-lg border-2 py-3 text-xs font-black uppercase tracking-wider transition-all ${
                            q.correctAnswer === val ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-200'
                          }`}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  )}

                  {q.type === 'short-answer' && (
                    <div className="space-y-3">
                       <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 font-mono">Assertion Keywords</label>
                          <span className="text-[9px] font-bold text-indigo-500 italic">Partial credit enabled: Separate multiple keywords with commas</span>
                       </div>
                      <input
                        type="text"
                        value={q.correctAnswer}
                        onChange={(e) => updateQuestion(q.id, { correctAnswer: e.target.value })}
                        placeholder="Keyword A, Keyword B, Keyword C..."
                        className="w-full rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-600 focus:bg-white focus:border-indigo-200 transition-all focus:outline-none"
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Credit Value:</label>
                       <input
                        type="number"
                        min="1"
                        value={q.points}
                        onChange={(e) => updateQuestion(q.id, { points: parseInt(e.target.value) || 1 })}
                        className="w-12 rounded bg-slate-50 border border-slate-100 px-1 py-0.5 text-center font-bold text-slate-700 text-xs focus:outline-none focus:border-indigo-200"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          <div className="flex flex-wrap items-center justify-center gap-3 py-10 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 w-full text-center mb-2">Append Component</span>
            <button
              onClick={() => addQuestion('multiple-choice')}
              className="flex items-center gap-2 px-5 py-2 bg-white rounded-lg text-xs font-bold shadow-sm border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> Multiple Choice
            </button>
            <button
              onClick={() => addQuestion('true-false')}
              className="flex items-center gap-2 px-5 py-2 bg-white rounded-lg text-xs font-bold shadow-sm border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> True / False
            </button>
            <button
              onClick={() => addQuestion('short-answer')}
              className="flex items-center gap-2 px-5 py-2 bg-white rounded-lg text-xs font-bold shadow-sm border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> Short Answer
            </button>
          </div>
        </div>
      </section>

      <DeleteModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        title="Discard Module"
        message="Are you sure you want to permanently delete this assessment? This action will purge all student data and the questionnaire metadata from the system."
        isDeleting={isDeleting}
      />
    </div>
  );
}
