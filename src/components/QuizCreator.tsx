import { useState, useEffect } from 'react';
import { collection, addDoc, doc, getDoc, updateDoc, deleteDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { Quiz, Question, QuestionType, UserProfile } from '../types';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Save, Plus, Trash2, ArrowLeft, GripVertical, CheckCircle2, Settings, Clock, Users, X, UserPlus, ShieldCheck, Search, ShieldAlert } from 'lucide-react';
import { cn } from '../lib/utils';
import DeleteModal from './DeleteModal';

export default function QuizCreator() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [retakeLimit, setRetakeLimit] = useState(1);
  const [timeLimit, setTimeLimit] = useState(0);
  const [isUnlimited, setIsUnlimited] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [allowedStudentIds, setAllowedStudentIds] = useState<string[]>([]);
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isFetching, setIsFetching] = useState(false);

  const [originalTitle, setOriginalTitle] = useState('');
  const [originalIsPublic, setOriginalIsPublic] = useState(false);
  const [originalAllowedIds, setOriginalAllowedIds] = useState<string[]>([]);

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const snap = await getDocs(query(collection(db, 'users'), where('role', '==', 'student')));
        setStudents(snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)));
      } catch (error) {
        console.error(error);
      }
    };
    fetchStudents();

    if (!id) return;

    const fetchQuiz = async () => {
      try {
        setIsFetching(true);
        const docRef = doc(db, 'quizzes', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as Quiz;
          setTitle(data.title);
          setOriginalTitle(data.title);
          setDescription(data.description);
          setQuestions(data.questions);
          setDeadline(data.deadline || '');
          setTimeLimit(data.timeLimit || 0);
          setAllowedStudentIds(data.allowedStudentIds || []);
          setOriginalAllowedIds(data.allowedStudentIds || []);
          setIsPublic(data.isPublic || false);
          setOriginalIsPublic(data.isPublic || false);
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
        deadline,
        allowedStudentIds,
        isPublic,
        updatedAt: new Date().toISOString()
      };
      
      let finalId = id;
      if (id) {
        await updateDoc(doc(db, 'quizzes', id), quizData);
      } else {
        const docRef = await addDoc(collection(db, 'quizzes'), {
          ...quizData,
          createdAt: new Date().toISOString()
        });
        finalId = docRef.id;
      }

      // 3. ENROLLMENT NOTIFICATION PROTOCOL
      // Trigger notifications for newly added students in private assessments
      if (!isPublic && finalId) {
        const newlyAdded = allowedStudentIds.filter(uid => !originalAllowedIds.includes(uid));
        if (newlyAdded.length > 0) {
          const notificationPromises = newlyAdded.map(uid => 
            addDoc(collection(db, 'notifications'), {
              userId: uid,
              title: 'New Assessment Assigned',
              message: `Educator ${profile.name} has enrolled you in "${title}".`,
              type: 'assignment',
              relatedId: finalId,
              isRead: false,
              createdAt: new Date().toISOString()
            })
          );
          await Promise.all(notificationPromises);
        }
      }

      // DATA SYNCHRONIZATION PROTOCOL
      // 1. Purge data for students who are no longer authorized (only if assessment is private)
      if (!isPublic && finalId) {
        const subSnap = await getDocs(query(
          collection(db, 'submissions'),
          where('quizId', '==', finalId)
        ));
        
        const unauthorizedSubs = subSnap.docs.filter(d => !allowedStudentIds.includes(d.data().studentId));
        if (unauthorizedSubs.length > 0) {
          const purgePromises = unauthorizedSubs.map(d => deleteDoc(doc(db, 'submissions', d.id)));
          await Promise.all(purgePromises);
        }
      }

      // 2. Cascade title changes to all existing result datasets
      if (id && title !== originalTitle) {
        const subSnap = await getDocs(query(
          collection(db, 'submissions'),
          where('quizId', '==', id)
        ));
        
        if (!subSnap.empty) {
          const updatePromises = subSnap.docs.map(d => updateDoc(doc(db, 'submissions', d.id), {
            quizTitle: title
          }));
          await Promise.all(updatePromises);
        }
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
          <button onClick={() => navigate('/teacher/assessments')} className="p-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-400">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
               {id ? 'Refine Assessment' : 'New Knowledge Module'}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Design and configure evaluation parameters.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {id && (
            <button
              onClick={() => setShowDeleteModal(true)}
              disabled={loading || isDeleting}
              className="p-2.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all border border-transparent hover:border-red-100 dark:hover:border-red-900/50 disabled:opacity-50"
              title="Delete Assessment"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={loading || isFetching || isDeleting || !title || questions.length === 0}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 dark:bg-indigo-500 text-white rounded-lg font-bold text-sm transition-all hover:bg-indigo-700 dark:hover:bg-indigo-600 disabled:opacity-50 shadow-lg shadow-indigo-600/20"
          >
            <Save className="w-4 h-4" />
            {loading ? 'Processing...' : (id ? 'Save Changes' : 'Finalize & Publish')}
          </button>
        </div>
      </header>

      <section className="space-y-8">
        <div className="bg-white dark:bg-slate-900 rounded-xl p-8 shadow-sm border border-slate-200 dark:border-slate-800 space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Questionnaire Heading</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Economics Mid-Term Phase 1"
              className="w-full text-2xl font-bold tracking-tight border-b-2 border-slate-100 dark:border-slate-800 bg-transparent text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none py-2 transition-all placeholder:text-slate-200 dark:placeholder:text-slate-700"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Executive Summary</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide a high-level overview of the assessment goals..."
              className="w-full text-sm text-slate-600 dark:text-slate-400 border-none focus:ring-0 p-0 resize-none h-16 bg-transparent placeholder:text-slate-200 dark:placeholder:text-slate-700 font-medium leading-relaxed italic"
            />
          </div>

          <div className="pt-6 border-t border-slate-50 dark:border-slate-800 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-500" />
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Strategic Access Control</label>
              </div>
              <div className="flex items-center gap-3">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                  <span className="ms-3 text-[8px] font-black uppercase tracking-tighter text-slate-500 dark:text-slate-400">Global Access</span>
                </label>
                <div className="h-4 w-[1px] bg-slate-100 dark:bg-slate-800 mx-1" />
                {isPublic ? (
                  <span className="text-[8px] font-black uppercase bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded border border-emerald-100 dark:border-emerald-800/50 flex items-center gap-1">
                    <ShieldCheck className="w-2 h-2" /> Global
                  </span>
                ) : (
                  <span className="text-[8px] font-black uppercase bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded border border-amber-100 dark:border-amber-800/50 flex items-center gap-1">
                    <ShieldCheck className="w-2 h-2" /> {allowedStudentIds.length} Authorized
                  </span>
                )}
              </div>
            </div>

            <AnimatePresence>
              {!isPublic && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="space-y-4 overflow-hidden"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1 group">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                      <input
                        type="text"
                        placeholder="Search and authorize specific students..."
                        value={studentSearch}
                        onChange={(e) => setStudentSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500/20 focus:outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600 italic"
                      />
                    </div>
                    {studentSearch && students.filter(s => s.name.toLowerCase().includes(studentSearch.toLowerCase())).length > 0 && (
                      <button
                        onClick={() => {
                          const filteredUids = students
                            .filter(s => s.name.toLowerCase().includes(studentSearch.toLowerCase()))
                            .map(s => s.uid);
                          setAllowedStudentIds(prev => Array.from(new Set([...prev, ...filteredUids])));
                        }}
                        className="px-4 py-2.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl text-[10px] font-black uppercase hover:bg-indigo-100 transition-all flex items-center gap-2"
                      >
                        <UserPlus className="w-3.5 h-3.5" /> Authorize Results
                      </button>
                    )}
                  </div>

                  {/* Selected Students Chips */}
                  {allowedStudentIds.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {allowedStudentIds.map(uid => {
                        const student = students.find(s => s.uid === uid);
                        if (!student) return null;
                        return (
                          <motion.div
                            key={uid}
                            layout
                            className="flex items-center gap-2 bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-lg border border-indigo-100 text-[10px] font-black group"
                          >
                            {student.name}
                            <button
                              onClick={() => setAllowedStudentIds(prev => prev.filter(id => id !== uid))}
                              className="hover:text-red-500 transition-colors"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </motion.div>
                        );
                      })}
                      <button 
                        onClick={() => setAllowedStudentIds([])}
                        className="text-[10px] font-bold text-slate-400 hover:text-red-500 px-2 py-1 transition-colors"
                      >
                        Clear All
                      </button>
                    </div>
                  )}

                  {/* Student Results List */}
                  <div className="grid gap-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                    {students
                      .filter(s => s.name.toLowerCase().includes(studentSearch.toLowerCase()))
                      .map(student => {
                        const isSelected = allowedStudentIds.includes(student.uid);
                        return (
                          <button
                            key={student.uid}
                            onClick={() => {
                              if (isSelected) {
                                setAllowedStudentIds(prev => prev.filter(id => id !== student.uid));
                              } else {
                                setAllowedStudentIds(prev => [...prev, student.uid]);
                              }
                            }}
                            className={cn(
                              "flex items-center justify-between p-3 rounded-xl border transition-all text-left group",
                              isSelected 
                                ? "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 shadow-sm" 
                                : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700"
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black transition-colors",
                                student.isBanned ? "bg-red-50 dark:bg-red-900/20 text-red-400" : (isSelected ? "bg-indigo-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-400 group-hover:bg-slate-200 dark:group-hover:bg-slate-700")
                              )}>
                                {student.isBanned ? <ShieldAlert className="w-4 h-4" /> : student.name.charAt(0)}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{student.name}</p>
                                  {student.isBanned && (
                                    <span className="text-[7px] font-black uppercase text-red-500 bg-red-50 dark:bg-red-900/20 px-1 rounded border border-red-100 dark:border-red-800">Restricted</span>
                                  )}
                                </div>
                                <p className="text-[9px] font-medium text-slate-400 dark:text-slate-500">{student.email}</p>
                              </div>
                            </div>
                            {isSelected ? (
                              <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-white">
                                <CheckCircle2 className="w-3 h-3" />
                              </div>
                            ) : (
                              <UserPlus className="w-4 h-4 text-slate-200 group-hover:text-slate-400 transition-colors" />
                            )}
                          </button>
                        );
                      })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            
            {isPublic ? (
               <p className="text-[9px] font-medium text-emerald-600 italic bg-emerald-50/50 p-2 rounded-lg border border-emerald-100/50">
                  Visible to the entire institution: All students are authorized to Launch this module.
               </p>
            ) : (
               <p className="text-[9px] font-medium text-slate-400 italic">
                  Private assessment: Only specifically authorized students above can view and Launch this module.
               </p>
            )}
          </div>

          <div className="pt-6 border-t border-slate-50 dark:border-slate-800">
            <div className="space-y-4">
               <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4 text-indigo-500" />
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Retake Configuration</label>
               </div>
               
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
                    <input
                      type="number"
                      min="1"
                      max="99"
                      disabled={isUnlimited}
                      value={retakeLimit}
                      onChange={(e) => setRetakeLimit(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-16 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                    />
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight">Standard Attempts</span>
                  </div>

                  <div className="flex items-center gap-3 px-4">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isUnlimited}
                        onChange={(e) => setIsUnlimited(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 dark:bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                      <span className="ms-3 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-tight">Unlimited Retakes</span>
                    </label>
                  </div>
               </div>

               <div className="pt-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-indigo-500" />
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Submission Deadline</label>
                  </div>
                  
                  <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700 max-w-[280px]">
                    <input
                      type="datetime-local"
                      value={deadline}
                      onChange={(e) => setDeadline(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:border-indigo-500 transition-all font-sans"
                    />
                  </div>
                  <p className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter italic">
                    Assessment lockout triggers automatically after this timestamp. Leave empty for continuous access.
                  </p>
               </div>

               <div className="pt-4 space-y-4">
                 <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-indigo-500" />
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Strategic Time Limit</label>
                 </div>
                 
                 <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700 max-w-[280px]">
                    <input
                      type="number"
                      min="0"
                      max="480"
                      value={timeLimit}
                      onChange={(e) => setTimeLimit(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-16 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight">Minutes Duration</span>
                      <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter">Set to 0 for unlimited time</span>
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
                className="group relative bg-white dark:bg-slate-900 rounded-xl p-8 shadow-sm border border-slate-200 dark:border-slate-800"
              >
                <div className="absolute left-6 top-8 text-slate-200 dark:text-slate-800 group-hover:text-indigo-200 dark:group-hover:text-indigo-900/50 transition-colors pointer-events-none">
                  <div className="w-8 h-8 rounded bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-400 dark:text-slate-500">
                    {index + 1}
                  </div>
                </div>

                <div className="ml-12 space-y-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                         <span className="px-2 py-0.5 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded border border-slate-100 dark:border-slate-700 text-[9px] font-black uppercase tracking-tighter">
                            {q.type.replace('-', ' ')}
                         </span>
                         <span className="text-[10px] font-bold text-slate-300 dark:text-slate-600">ID: {q.id.split('-')[0]}</span>
                      </div>
                      <input
                        type="text"
                        value={q.question}
                        onChange={(e) => updateQuestion(q.id, { question: e.target.value })}
                        placeholder="Enter strategic question content..."
                        className="w-full text-lg font-bold border-none focus:ring-0 p-0 bg-transparent text-slate-800 dark:text-white placeholder:text-slate-200 dark:placeholder:text-slate-700"
                      />
                    </div>
                    <button onClick={() => removeQuestion(q.id)} className="p-2 text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 transition-colors hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {q.type === 'multiple-choice' && q.options && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {q.options.map((opt, optIdx) => (
                        <div key={optIdx} className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border border-slate-100 dark:border-slate-700 focus-within:border-indigo-200 dark:focus-within:border-indigo-800 transition-all">
                          <button
                            onClick={() => updateQuestion(q.id, { correctAnswer: optIdx.toString() })}
                            className={`h-5 w-5 flex-shrink-0 rounded-full border-2 transition-all flex items-center justify-center ${
                              q.correctAnswer === optIdx.toString() ? 'bg-indigo-600 dark:bg-indigo-500 border-indigo-600 dark:border-indigo-500 text-white shadow-lg shadow-indigo-600/20' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900'
                            }`}
                          >
                            {q.correctAnswer === optIdx.toString() && <CheckCircle2 className="h-3 w-3" />}
                          </button>
                          <input
                            type="text"
                            value={opt}
                            onChange={(e) => updateOption(q.id, optIdx, e.target.value)}
                            placeholder={`Variable Option ${optIdx + 1}`}
                            className="w-full bg-transparent border-none focus:ring-0 p-0 text-xs font-bold text-slate-600 dark:text-slate-400 placeholder:text-slate-300 dark:placeholder:text-slate-700 italic"
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
                            q.correctAnswer === val ? 'bg-indigo-600 dark:bg-indigo-500 border-indigo-600 dark:border-indigo-500 text-white shadow-lg shadow-indigo-600/20' : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 hover:border-slate-200 dark:hover:border-slate-700'
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
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 font-mono">Assertion Keywords</label>
                          <span className="text-[9px] font-bold text-indigo-500 dark:text-indigo-400 italic">Partial credit enabled: Separate multiple keywords with commas</span>
                       </div>
                      <input
                        type="text"
                        value={q.correctAnswer}
                        onChange={(e) => updateQuestion(q.id, { correctAnswer: e.target.value })}
                        placeholder="Keyword A, Keyword B, Keyword C..."
                        className="w-full rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 px-4 py-3 text-xs font-bold text-slate-600 dark:text-slate-300 focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-200 dark:focus:border-indigo-800 transition-all focus:outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600"
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-4 border-t border-slate-50 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Credit Value:</label>
                       <input
                        type="number"
                        min="1"
                        value={q.points}
                        onChange={(e) => updateQuestion(q.id, { points: parseInt(e.target.value) || 1 })}
                        className="w-12 rounded bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 px-1 py-0.5 text-center font-bold text-slate-700 dark:text-slate-200 text-xs focus:outline-none focus:border-indigo-200 dark:focus:border-indigo-800"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          <div className="flex flex-wrap items-center justify-center gap-3 py-10 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/50">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 dark:text-slate-600 w-full text-center mb-2">Append Component</span>
            <button
              onClick={() => addQuestion('multiple-choice')}
              className="flex items-center gap-2 px-5 py-2 bg-white dark:bg-slate-900 rounded-lg text-xs font-bold shadow-sm border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-indigo-300 dark:hover:border-indigo-800 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> Multiple Choice
            </button>
            <button
              onClick={() => addQuestion('true-false')}
              className="flex items-center gap-2 px-5 py-2 bg-white dark:bg-slate-900 rounded-lg text-xs font-bold shadow-sm border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-indigo-300 dark:hover:border-indigo-800 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> True / False
            </button>
            <button
              onClick={() => addQuestion('short-answer')}
              className="flex items-center gap-2 px-5 py-2 bg-white dark:bg-slate-900 rounded-lg text-xs font-bold shadow-sm border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-indigo-300 dark:hover:border-indigo-800 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all"
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
