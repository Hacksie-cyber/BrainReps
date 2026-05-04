import { useState, useEffect, ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, orderBy, limit, doc, updateDoc } from 'firebase/firestore';
import { QuizSubmission } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { User, Mail, Shield, Calendar, Trophy, Zap, Target, BookOpen, ChevronRight, Award, Star, Activity, Settings, Bell, Palette, X, Camera, Save, Loader2, Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';

export default function StudentProfile() {
  const { profile } = useAuth();
  const [submissions, setSubmissions] = useState<QuizSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    photoURL: '',
    bio: ''
  });
  const [updating, setUpdating] = useState(false);

  const handleImageUpdate = (e: ChangeEvent<HTMLInputElement>) => {
    setEditForm(prev => ({ ...prev, photoURL: e.target.value }));
  };

  useEffect(() => {
    if (!profile) return;
    setEditForm({
      name: profile.name || '',
      photoURL: profile.photoURL || '',
      bio: profile.bio || ''
    });

    const fetchSubmissions = async () => {
      try {
        const q = query(
          collection(db, 'submissions'),
          where('studentId', '==', profile.uid),
          orderBy('submittedAt', 'desc'),
          limit(50)
        );
        const snapshot = await getDocs(q);
        const subs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as QuizSubmission));
        setSubmissions(subs);
      } catch (error) {
        console.error('Failed to fetch profile stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSubmissions();
  }, [profile]);

  if (!profile) return null;

  const handleUpdateProfile = async () => {
    if (!profile) return;
    setUpdating(true);
    try {
      const userRef = doc(db, 'users', profile.uid);
      await updateDoc(userRef, {
        name: editForm.name,
        photoURL: editForm.photoURL,
        bio: editForm.bio
      });
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update profile:', error);
      alert('Failed to update profile. Please check your connection and try again.');
    } finally {
      setUpdating(false);
    }
  };

  const stats = {
    totalAttempts: submissions.length,
    averageScore: submissions.length > 0
      ? Math.round((submissions.reduce((acc, s) => acc + (s.score / s.totalPoints), 0) / submissions.length) * 100)
      : 0,
    perfectScores: submissions.filter(s => s.score === s.totalPoints).length,
    lastActivity: submissions.length > 0 ? new Date(submissions[0].submittedAt).toLocaleDateString() : 'No activity yet'
  };

  const getAcademicLevel = (score: number) => {
    if (score >= 90) return { label: 'Scholar', color: 'text-indigo-600 bg-indigo-50 border-indigo-100', icon: Trophy };
    if (score >= 70) return { label: 'Practitioner', color: 'text-emerald-600 bg-emerald-50 border-emerald-100', icon: Target };
    return { label: 'Novice', color: 'text-slate-500 bg-slate-50 border-slate-100', icon: BookOpen };
  };

  const LevelBadge = getAcademicLevel(stats.averageScore);

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      {/* Profile Header Card */}
      <section className="relative overflow-hidden bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none">
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-r from-indigo-600 to-violet-600 opacity-10 dark:opacity-20" />
        
        <div className="relative p-8 pt-16 flex flex-col md:flex-row md:items-end justify-between gap-8">
          <div className="flex flex-col md:flex-row items-center md:items-end gap-6 text-center md:text-left">
            <div className="relative group">
              <div className="w-32 h-32 rounded-3xl bg-indigo-600 flex items-center justify-center text-white text-4xl font-black shadow-2xl shadow-indigo-600/30 transform group-hover:rotate-3 transition-transform overflow-hidden group-hover:ring-4 ring-indigo-500/20">
                {profile.photoURL ? (
                  <img src={profile.photoURL} alt={profile.name} className="w-full h-full object-cover" />
                ) : (
                  profile.name.charAt(0)
                )}
              </div>
              <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-emerald-500 rounded-xl border-4 border-white dark:border-slate-900 flex items-center justify-center text-white">
                <Zap className="w-5 h-5 fill-current" />
              </div>
              {isEditing && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity">
                   <Camera className="w-8 h-8 text-white" />
                </div>
              )}
            </div>

            <div className="space-y-1">
              <div className="flex flex-col md:flex-row md:items-center gap-3">
                <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                  {profile.name}
                </h1>
                <div className={cn("px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 mx-auto md:mx-0", LevelBadge.color)}>
                  <LevelBadge.icon className="w-3.5 h-3.5" />
                  {LevelBadge.label}
                </div>
              </div>
              <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400 italic">
                {profile.bio || "The curriculum is a gym; the brain is the muscle."}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2">
            {!isEditing ? (
              <>
                <button 
                  onClick={() => setIsEditing(true)}
                  className="p-3 bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 rounded-2xl border border-slate-200 dark:border-slate-700 hover:text-indigo-600 transition-colors"
                >
                  <Settings className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold text-sm shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 transition-all active:scale-95"
                >
                  Edit Curriculum Profile
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-3 text-slate-500 font-bold text-sm hover:text-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  disabled={updating}
                  onClick={handleUpdateProfile}
                  className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl font-bold text-sm shadow-xl shadow-emerald-600/20 hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Changes
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Edit Modal / Section Overlay */}
        <AnimatePresence>
          {isEditing && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800"
            >
              <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                       <Camera className="w-3 h-3" /> Profile Picture URL
                    </label>
                    <div className="flex gap-4">
                       <div className="w-20 h-20 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                          {editForm.photoURL ? (
                            <img 
                              src={editForm.photoURL} 
                              alt="Preview" 
                              className="w-full h-full object-cover" 
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(editForm.name)}&background=random`;
                              }}
                            />
                          ) : (
                            <Camera className="w-6 h-6 text-slate-300" />
                          )}
                       </div>
                       <div className="flex-1 space-y-2">
                          <div className="relative group">
                            <input 
                              type="url" 
                              value={editForm.photoURL}
                              onChange={handleImageUpdate}
                              className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-xs font-bold"
                              placeholder="Paste image URL here..."
                            />
                          </div>
                          <p className="text-[9px] font-medium text-slate-400 italic">Provide a direct link to your portrait image.</p>
                       </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                      <User className="w-3 h-3" /> Full Identity Name
                    </label>
                    <input 
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm font-bold"
                      placeholder="Enter legal or creative name..."
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                    <Sparkles className="w-3 h-3" /> Academic Bio / Description
                  </label>
                  <textarea 
                    value={editForm.bio}
                    onChange={(e) => setEditForm(prev => ({ ...prev, bio: e.target.value }))}
                    className="w-full h-[124px] px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm font-medium resize-none"
                    placeholder="Briefly describe your academic focus or personal philosophy..."
                  />
                  <p className="text-[9px] font-bold text-slate-400 text-right">Maximum 500 characters</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 md:grid-cols-3 border-t border-slate-100 dark:border-slate-800">
           <div className="p-6 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-800 group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-1">Knowledge Density</p>
              <div className="flex items-baseline gap-1">
                 <span className="text-3xl font-black text-slate-900 dark:text-white">{stats.averageScore}%</span>
                 <span className="text-xs font-bold text-emerald-500">AVG</span>
              </div>
           </div>
           <div className="p-6 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-800 group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-1">Modules Mastery</p>
              <div className="flex items-baseline gap-1">
                 <span className="text-3xl font-black text-slate-900 dark:text-white">{stats.totalAttempts}</span>
                 <span className="text-xs font-bold text-indigo-500">TOTAL</span>
              </div>
           </div>
           <div className="p-6 flex flex-col items-center justify-center group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-1">Perfect Logic</p>
              <div className="flex items-baseline gap-1">
                 <span className="text-3xl font-black text-slate-900 dark:text-white">{stats.perfectScores}</span>
                 <span className="text-xs font-bold text-amber-500">100%</span>
              </div>
           </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Contact & Meta Column */}
        <div className="lg:col-span-1 space-y-8">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-6">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 flex items-center gap-2">
              <Shield className="w-4 h-4" /> Identity Credentials
            </h3>
            
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 flex items-center justify-center text-slate-400">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">Verified Contact</p>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate max-w-[180px]">{profile.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 flex items-center justify-center text-slate-400">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">Academic Tenure</p>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Enrolled Since 2026</p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 flex items-center justify-center text-slate-400">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">Latest Pulse</p>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{stats.lastActivity}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-indigo-600 rounded-3xl p-6 text-white space-y-4 shadow-xl shadow-indigo-600/20">
             <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-widest text-indigo-200">Achievement Path</h3>
                <Star className="w-5 h-5 fill-current text-white" />
             </div>
             <p className="text-sm font-medium leading-relaxed italic opacity-90">
                "Logic is the beginning of wisdom, not the end."
             </p>
             <div className="pt-4 space-y-2">
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-tighter">
                   <span>Curriculum XP</span>
                   <span>{stats.totalAttempts * 100} / 5000</span>
                </div>
                <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                   <div 
                    className="h-full bg-white transition-all duration-1000" 
                    style={{ width: `${Math.min(100, (stats.totalAttempts * 100) / 5000 * 100)}%` }} 
                   />
                </div>
             </div>
          </div>
        </div>

        {/* Achievement Timeline Column */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8">
            <div className="flex items-center justify-between mb-8">
               <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
                  <Award className="w-6 h-6 text-indigo-500" />
                  Recent Academic Accomplishments
               </h3>
               <Link 
                to="/student/performance"
                className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-700 transition-colors"
               >
                  View Full Transcript
               </Link>
            </div>

            <div className="space-y-4">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-20 bg-slate-50 dark:bg-slate-800/50 rounded-2xl animate-pulse" />
                ))
              ) : submissions.length === 0 ? (
                <div className="py-20 text-center space-y-4">
                   <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-300 mx-auto">
                      <BookOpen className="w-8 h-8" />
                   </div>
                   <p className="text-slate-400 dark:text-slate-600 italic font-medium">No instructional assessments detected in your ledger.</p>
                </div>
              ) : (
                submissions.slice(0, 5).map((sub, i) => (
                  <Link
                    key={sub.id}
                    to={`/student/performance`} // Navigate to performance tab for review
                    className="flex"
                  >
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="group flex-1 flex items-center justify-between p-5 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-indigo-100 dark:hover:border-indigo-900 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-all"
                    >
                      <div className="flex items-center gap-5">
                        <div className={cn(
                          "w-12 h-12 rounded-xl flex items-center justify-center transition-all group-hover:scale-110",
                          (sub.score / sub.totalPoints) >= 0.9 ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500" :
                          (sub.score / sub.totalPoints) >= 0.7 ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500" :
                          "bg-amber-50 dark:bg-amber-900/20 text-amber-500"
                        )}>
                            <Zap className="w-6 h-6 fill-current" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-200 tracking-tight group-hover:text-indigo-600 transition-colors">{sub.quizTitle}</p>
                            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter">{new Date(sub.submittedAt).toLocaleDateString()} • Attempt ID: {sub.id.slice(0, 8)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-black text-slate-900 dark:text-white leading-none">{Math.round((sub.score / sub.totalPoints) * 100)}%</p>
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{sub.score}/{sub.totalPoints} PTS</p>
                      </div>
                    </motion.div>
                  </Link>
                ))
              )}
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-200 dark:border-slate-800 p-8">
             <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                   <Palette className="w-5 h-5 text-indigo-500" />
                   <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-slate-200">Terminal Customization</h3>
                </div>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between group cursor-pointer hover:border-indigo-100 transition-all">
                   <div className="flex items-center gap-3">
                      <Bell className="w-4 h-4 text-slate-400 group-hover:text-amber-500" />
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Knowledge Notifications</span>
                   </div>
                   <div className="w-8 h-4 bg-emerald-500 rounded-full relative">
                      <div className="absolute right-0.5 top-0.5 w-3 h-3 bg-white rounded-full" />
                   </div>
                </div>

                <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between group cursor-pointer hover:border-indigo-100 transition-all">
                   <div className="flex items-center gap-3">
                      <Shield className="w-4 h-4 text-slate-400 group-hover:text-indigo-500" />
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Privacy Protocol 2.0</span>
                   </div>
                   <div className="w-8 h-4 bg-slate-200 dark:bg-slate-700 rounded-full relative">
                      <div className="absolute left-0.5 top-0.5 w-3 h-3 bg-white rounded-full" />
                   </div>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
