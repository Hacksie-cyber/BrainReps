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
        
        // Notify all students if changed from private to public
        if (isPublic && !originalIsPublic) {
          const studentSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'student')));
          const notificationPromises = studentSnap.docs.map(studentDoc => 
            addDoc(collection(db, 'notifications'), {
              userId: studentDoc.id,
              title: 'Module Now Public',
              message: `Educator ${profile.name} has opened "${title}" for global institutional access.`,
              type: 'assignment',
              relatedId: id,
              isRead: false,
              createdAt: new Date().toISOString()
            })
          );
          await Promise.all(notificationPromises);
        }
      } else {
        const docRef = await addDoc(collection(db, 'quizzes'), {
          ...quizData,
          createdAt: new Date().toISOString()
        });
        finalId = docRef.id;

        // Notify all students if it's a new public quiz
        if (isPublic) {
          const studentSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'student')));
          const notificationPromises = studentSnap.docs.map(studentDoc => 
            addDoc(collection(db, 'notifications'), {
              userId: studentDoc.id,
              title: 'New Module Published',
              message: `Educator ${profile.name} has released "${title}" for global enrollment.`,
              type: 'assignment',
              relatedId: finalId,
              isRead: false,
              createdAt: new Date().toISOString()
            })
          );
          await Promise.all(notificationPromises);
        }
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
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 shadow-sm border border-slate-200 dark:border-slate-800/80 space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Quiz / Module Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Economics Mid-Term Quiz"
              className="w-full text-lg font-semibold border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/40 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 py-3 px-4 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Description & Instructions for Students</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide clean instructions, topics covered, or goals of this module..."
              className="w-full text-sm text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/40 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 py-2.5 px-4 resize-none h-20 placeholder:text-slate-400 dark:placeholder:text-slate-600 font-medium leading-normal"
            />
          </div>

          <div className="pt-6 border-t border-slate-150 dark:border-slate-800 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-500" />
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Student Access Control</label>
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
                  <span className="ms-3 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">Publicly Available</span>
                </label>
                <div className="h-4 w-[1px] bg-slate-150 dark:bg-slate-800 mx-1" />
                {isPublic ? (
                  <span className="text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-lg border border-emerald-100 dark:border-emerald-950/30 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Public
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-650 dark:text-indigo-400 px-2.5 py-1 rounded-lg border border-indigo-100 dark:border-indigo-950/40 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> {allowedStudentIds.length} Selected
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
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                      <input
                        type="text"
                        placeholder="Search student names to authorize specific access..."
                        value={studentSearch}
                        onChange={(e) => setStudentSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-350 focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 focus:outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-550"
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
                        className="px-4 py-2.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900 rounded-xl text-[10px] font-black uppercase hover:bg-indigo-100 transition-all flex items-center gap-2"
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
                            className="flex items-center gap-2 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 px-3 py-1.5 rounded-lg border border-indigo-100 dark:border-indigo-900/40 text-xs font-semibold shadow-sm group"
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
                        className="text-xs font-bold text-slate-400 hover:text-red-500 px-2 py-1 transition-colors"
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
                                : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-slate-250 dark:hover:border-slate-700"
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black transition-colors overflow-hidden",
                                student.isBanned ? "bg-red-50 dark:bg-red-900/20 text-red-400" : (isSelected ? "bg-indigo-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-400 group-hover:bg-slate-200 dark:group-hover:bg-slate-700")
                              )}>
                                {student.isBanned ? (
                                  <ShieldAlert className="w-4 h-4" />
                                ) : student.photoURL ? (
                                  <img src={student.photoURL} alt={student.name} className="w-full h-full object-cover" />
                                ) : (
                                  student.name.charAt(0)
                                )}
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
              <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 italic bg-emerald-50/30 dark:bg-emerald-950/20 p-3 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
                ✓ Visible to all students. Everyone in the cohort is authorized to take this module.
              </p>
            ) : (
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 italic bg-slate-50/50 dark:bg-slate-800/20 p-3 rounded-xl border border-slate-200/50 dark:border-slate-850">
                🔒 Private Assessment. Only specifically authorized students above will be eligible.
              </p>
            )}
          </div>

          <div className="pt-8 border-t border-slate-150 dark:border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-6 flex items-center gap-2">
              <Settings className="w-4 h-4 text-indigo-500" />
              Settings & Assessment Policies
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Attempts Card */}
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800/60 flex flex-col justify-between space-y-4">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">Attempt Limit</h4>
                  <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 leading-normal">Set maximum retakes allowed for standard takers.</p>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center gap-2.5">
                    <input
                      type="number"
                      min="1"
                      max="99"
                      disabled={isUnlimited}
                      value={retakeLimit}
                      onChange={(e) => setRetakeLimit(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-16 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-black text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50"
                    />
                    <span className="text-xs font-semibold text-slate-550 dark:text-slate-400">Attempts</span>
                  </div>
                  
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isUnlimited}
                      onChange={(e) => setIsUnlimited(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                    <span className="ms-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400">Unlimited Attempts</span>
                  </label>
                </div>
              </div>

              {/* Deadline Card */}
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800/60 flex flex-col justify-between space-y-4">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">Due Date & Deadline</h4>
                  <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 leading-normal">Assessment lockout triggers automatically after this timestamp.</p>
                </div>
                
                <input
                  type="datetime-local"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all font-sans"
                />
              </div>

              {/* Time Limit Card */}
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800/60 flex flex-col justify-between space-y-4">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">Time Limit Duration</h4>
                  <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 leading-normal">Set maximum duration allowed per run. Set to 0 for unlimited time.</p>
                </div>
                
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="0"
                    max="480"
                    value={timeLimit}
                    onChange={(e) => setTimeLimit(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-18 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-black text-slate-750 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-350">{timeLimit > 0 ? `${timeLimit} Minutes limit` : 'No time limit'}</span>
                    <span className="text-[10px] text-slate-450 dark:text-slate-500">Enable quiz duration countdown</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <AnimatePresence>
            {questions.map((q, index) => (
              <motion.div
                key={q.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="group relative bg-white dark:bg-slate-900 rounded-2xl p-6 md:p-8 shadow-sm border border-slate-200 dark:border-slate-800/80 transition-all hover:border-slate-300 dark:hover:border-slate-700"
              >
                {/* Clean Header Row for the Question Card */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4 mb-6">
                  <div className="flex items-center gap-3">
                    <span className="h-8 w-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-sm font-black shadow-inner">
                      {index + 1}
                    </span>
                    <span className="px-3 py-1 bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 rounded-lg text-[10px] font-black uppercase tracking-wider border border-slate-150 dark:border-slate-800">
                      {q.type.replace('-', ' ')}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 hidden md:inline">({q.id.split('-')[0]})</span>
                  </div>
                  
                  <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Question Weight:</span>
                      <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 px-2 py-1 rounded-xl">
                        <input
                          type="number"
                          min="1"
                          value={q.points}
                          onChange={(e) => updateQuestion(q.id, { points: Math.max(1, parseInt(e.target.value) || 1) })}
                          className="w-10 h-6 bg-transparent text-center font-black text-slate-800 dark:text-slate-200 text-xs focus:outline-none transition-all"
                        />
                        <span className="text-[10px] font-bold text-slate-405 dark:text-slate-500 uppercase">Pts</span>
                      </div>
                    </div>
                    
                    <div className="h-4 w-[1px] bg-slate-150 dark:bg-slate-800 hidden sm:block" />
                    
                    <button 
                      onClick={() => removeQuestion(q.id)} 
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-all"
                      title="Remove Question"
                    >
                      <Trash2 className="h-4.5 w-4.5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Question Prompt Input */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Question Text</label>
                    <input
                      type="text"
                      value={q.question}
                      onChange={(e) => updateQuestion(q.id, { question: e.target.value })}
                      placeholder="e.g. Which of the following is a key driver of inflation?"
                      className="w-full text-base font-semibold border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 focus:bg-white dark:bg-slate-950/45 dark:focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 px-4 py-3 text-slate-900 dark:text-white transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
                    />
                  </div>

                  {/* Multiple Choice Options */}
                  {q.type === 'multiple-choice' && q.options && (
                    <div className="space-y-3">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Options (Select the correct radio option)</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        {q.options.map((opt, optIdx) => (
                          <div 
                            key={optIdx} 
                            className={cn(
                              "flex items-center gap-3 p-3 rounded-xl border transition-all duration-200",
                              q.correctAnswer === optIdx.toString()
                                ? "bg-indigo-50/40 dark:bg-indigo-950/10 border-indigo-200 dark:border-indigo-900/50 shadow-sm"
                                : "bg-slate-50/40 dark:bg-slate-950/20 border-slate-200 dark:border-slate-800/80 focus-within:border-slate-350 dark:focus-within:border-slate-600"
                            )}
                          >
                            <button
                              type="button"
                              onClick={() => updateQuestion(q.id, { correctAnswer: optIdx.toString() })}
                              className={cn(
                                "h-5 w-5 flex-shrink-0 rounded-full border-2 transition-all flex items-center justify-center",
                                q.correctAnswer === optIdx.toString() 
                                  ? 'bg-indigo-600 dark:bg-indigo-500 border-indigo-600 dark:border-indigo-500 text-white shadow shadow-indigo-600/30' 
                                  : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900'
                              )}
                              title="Set as Correct Answer"
                            >
                              {q.correctAnswer === optIdx.toString() && <CheckCircle2 className="h-3.5 w-3.5" />}
                            </button>
                            <input
                              type="text"
                              value={opt}
                              onChange={(e) => updateOption(q.id, optIdx, e.target.value)}
                              placeholder={`Option ${optIdx + 1}`}
                              className="w-full bg-transparent border-none focus:ring-0 p-0 text-xs font-semibold text-slate-700 dark:text-slate-300 placeholder:text-slate-400 dark:placeholder:text-slate-600"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* True / False Statement Options */}
                  {q.type === 'true-false' && (
                    <div className="space-y-3">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Correct Answer Choice</p>
                      <div className="flex gap-3">
                        {['true', 'false'].map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => updateQuestion(q.id, { correctAnswer: val })}
                            className={cn(
                              "flex-1 rounded-xl border-2 py-3 text-xs font-bold uppercase tracking-wider transition-all",
                              q.correctAnswer === val 
                                ? 'bg-indigo-600 dark:bg-indigo-500 border-indigo-600 dark:border-indigo-500 text-white shadow-md' 
                                : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                            )}
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Short Answer (Assertion Keywords) */}
                  {q.type === 'short-answer' && (
                    <div className="space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Answer Keywords / Keyphrases</label>
                        <span className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400 italic">Separate alternative keywords with commas (for automatic scanner)</span>
                      </div>
                      <input
                        type="text"
                        value={q.correctAnswer}
                        onChange={(e) => updateQuestion(q.id, { correctAnswer: e.target.value })}
                        placeholder="e.g. GDP, gross domestic product, economic outputs"
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 px-4 py-3 text-xs font-bold text-slate-750 dark:text-slate-300 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400"
                      />
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Add Question Selector */}
          <div className="flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-slate-205 dark:border-slate-800/80 rounded-2xl bg-slate-50/30 dark:bg-slate-950/10 space-y-4">
            <div className="space-y-1.5">
              <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Append New Question Component</h4>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">Select a question template below to insert it at the end of your assessment.</p>
            </div>
            
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => addQuestion('multiple-choice')}
                className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-900 rounded-xl text-xs font-bold shadow-sm border border-slate-200 dark:border-slate-800 text-slate-650 dark:text-slate-450 hover:border-indigo-305 dark:hover:border-indigo-800 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all hover:-translate-y-0.5 active:translate-y-0"
              >
                <Plus className="w-3.5 h-3.5" /> Multiple Choice
              </button>
              <button
                type="button"
                onClick={() => addQuestion('true-false')}
                className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-900 rounded-xl text-xs font-bold shadow-sm border border-slate-200 dark:border-slate-800 text-slate-650 dark:text-slate-450 hover:border-indigo-305 dark:hover:border-indigo-800 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all hover:-translate-y-0.5 active:translate-y-0"
              >
                <Plus className="w-3.5 h-3.5" /> True / False
              </button>
              <button
                type="button"
                onClick={() => addQuestion('short-answer')}
                className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-900 rounded-xl text-xs font-bold shadow-sm border border-slate-200 dark:border-slate-800 text-slate-650 dark:text-slate-450 hover:border-indigo-305 dark:hover:border-indigo-800 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all hover:-translate-y-0.5 active:translate-y-0"
              >
                <Plus className="w-3.5 h-3.5" /> Short Answer
              </button>
            </div>
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
