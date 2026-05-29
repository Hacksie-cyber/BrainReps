import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc, orderBy, addDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { UserProfile, Notification } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Trash2, 
  Ban, 
  Search, 
  Calendar, 
  Mail, 
  MoreVertical, 
  ShieldAlert,
  ShieldCheck,
  RefreshCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Megaphone,
  Send,
  Sparkles,
  Info,
  Clock,
  Check,
  GraduationCap
} from 'lucide-react';
import { cn } from '../lib/utils';
import DeleteModal from './DeleteModal';

export default function AdminManagement() {
  const { profile } = useAuth();
  
  // Tab controller state
  const [activeTab, setActiveTab] = useState<'faculty' | 'announcements'>('faculty');
  
  // Faculty control state
  const [teachers, setTeachers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [teacherToDelete, setTeacherToDelete] = useState<UserProfile | null>(null);

  // Announcements dispatch state
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementMessage, setAnnouncementMessage] = useState('');
  const [targetAudience, setTargetAudience] = useState<'all' | 'teacher' | 'student'>('all');
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState(false);
  
  const [announcements, setAnnouncements] = useState<Notification[]>([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);
  const [announcementToDelete, setAnnouncementToDelete] = useState<Notification | null>(null);
  const [isDeletingAnnouncement, setIsDeletingAnnouncement] = useState(false);

  useEffect(() => {
    fetchTeachers();
  }, []);

  useEffect(() => {
    if (activeTab === 'announcements') {
      fetchAnnouncements();
    }
  }, [activeTab]);

  const fetchTeachers = async () => {
    try {
      setLoading(true);
      const q = query(
        collection(db, 'users'),
        where('role', '==', 'teacher')
      );
      let snap;
      try {
        snap = await getDocs(q);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'users/teachers');
        return;
      }
      const list = snap.docs
        .map(d => ({ uid: d.id, ...d.data() } as UserProfile))
        .filter(t => t.email !== 'bamuyahacksie@gmail.com')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setTeachers(list);
    } catch (error) {
      console.error("Failed to fetch teachers:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnnouncements = async () => {
    try {
      setAnnouncementsLoading(true);
      const q = query(
        collection(db, 'notifications'),
        where('userId', '==', 'announcement_archive')
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Notification));
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setAnnouncements(list);
    } catch (error) {
      console.error("Failed to fetch announcements:", error);
    } finally {
      setAnnouncementsLoading(false);
    }
  };

  const handleRefresh = () => {
    if (activeTab === 'faculty') {
      fetchTeachers();
    } else {
      fetchAnnouncements();
    }
  };

  const toggleBan = async (teacher: UserProfile) => {
    try {
      const newStatus = !teacher.isBanned;
      await updateDoc(doc(db, 'users', teacher.uid), {
        isBanned: newStatus
      });
      setTeachers(teachers.map(t => 
        t.uid === teacher.uid ? { ...t, isBanned: newStatus } : t
      ));
    } catch (error) {
      console.error("Failed to toggle ban status:", error);
      alert("System error: Failed to update access status.");
    }
  };

  const handleDeleteTeacher = async () => {
    if (!teacherToDelete) return;
    
    try {
      setIsDeleting(teacherToDelete.uid);
      
      // 1. Purge all associated submissions and curriculum data
      const subQuery = query(collection(db, 'submissions'), where('teacherId', '==', teacherToDelete.uid));
      const subSnap = await getDocs(subQuery);
      if (!subSnap.empty) {
        const subDeletePromises = subSnap.docs.map(d => deleteDoc(doc(db, 'submissions', d.id)));
        await Promise.all(subDeletePromises);
      }

      // 2. Delete associated assessments
      const quizQuery = query(collection(db, 'quizzes'), where('teacherId', '==', teacherToDelete.uid));
      const quizSnap = await getDocs(quizQuery);
      if (!quizSnap.empty) {
        const quizDeletePromises = quizSnap.docs.map(d => deleteDoc(doc(db, 'quizzes', d.id)));
        await Promise.all(quizDeletePromises);
      }

      // 3. Delete teacher profile
      await deleteDoc(doc(db, 'users', teacherToDelete.uid));
      
      setTeachers(teachers.filter(t => t.uid !== teacherToDelete.uid));
      setTeacherToDelete(null);
    } catch (error) {
      console.error("Failed to delete teacher:", error);
      alert("System integrity error: Failed to purge teacher records.");
    } finally {
      setIsDeleting(null);
    }
  };

  const handlePublishAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!announcementTitle.trim() || !announcementMessage.trim()) return;

    try {
      setIsPublishing(true);
      setPublishSuccess(false);

      // 1. Fetch targeted recipients
      const usersSnap = await getDocs(collection(db, 'users'));
      const allUsers = usersSnap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));

      // Filter based on selected audience
      const targets = allUsers.filter(u => {
        // Skip sender
        if (u.uid === profile?.uid) return false;
        
        if (targetAudience === 'all') return true;
        return u.role === targetAudience;
      });

      const timestamp = new Date().toISOString();

      // 2. Save archive copy for admin history display
      const archiveCopy = {
        userId: 'announcement_archive',
        title: announcementTitle.trim(),
        message: announcementMessage.trim(),
        type: 'system',
        relatedId: `announcement_${targetAudience}`, // Encode target audience inside relatedId
        isRead: false,
        createdAt: timestamp
      };
      await addDoc(collection(db, 'notifications'), archiveCopy);

      // 3. Dispatch individually to all matched recipients
      const notifyPromises = targets.map(recipient => {
        const payload = {
          userId: recipient.uid,
          title: announcementTitle.trim(),
          message: announcementMessage.trim(),
          type: 'system',
          relatedId: 'announcement',
          isRead: false,
          createdAt: timestamp
        };
        return addDoc(collection(db, 'notifications'), payload);
      });

      await Promise.all(notifyPromises);

      // 4. Update state variables on completion
      setAnnouncementTitle('');
      setAnnouncementMessage('');
      setPublishSuccess(true);
      setTimeout(() => setPublishSuccess(false), 5000);
      
      // Update local archive feed
      fetchAnnouncements();
    } catch (error) {
      console.error("Failed to broadcast announcement:", error);
      alert("Error occurred while broadcasting the system notification.");
    } finally {
      setIsPublishing(false);
    }
  };

  const handleDeleteAnnouncement = async () => {
    if (!announcementToDelete) return;
    try {
      setIsDeletingAnnouncement(true);
      await deleteDoc(doc(db, 'notifications', announcementToDelete.id));
      setAnnouncements(announcements.filter(a => a.id !== announcementToDelete.id));
      setAnnouncementToDelete(null);
    } catch (error) {
      console.error("Failed to purge announcement archive:", error);
    } finally {
      setIsDeletingAnnouncement(false);
    }
  };

  const filteredTeachers = teachers.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-3">
            {activeTab === 'faculty' ? (
              <>
                <ShieldAlert className="h-6 w-6 text-indigo-600" />
                Faculty Control Center
              </>
            ) : (
              <>
                <Megaphone className="h-6 w-6 text-indigo-600 animate-bounce" />
                Announcements Broadcast
              </>
            )}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium tracking-tight">
            {activeTab === 'faculty' 
              ? "High-level oversight of registered teacher accounts and access permissions."
              : "Compose and dispatch system-wide notifications to students and educators."
            }
          </p>
        </div>
        <button 
          onClick={handleRefresh}
          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95 shadow-sm"
        >
          <RefreshCcw className="h-4 w-4" />
          {activeTab === 'faculty' ? "Refresh Registry" : "Refresh Feed"}
        </button>
      </header>

      {/* Admin Operations Selector Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('faculty')}
          className={cn(
            "px-6 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2.5",
            activeTab === 'faculty'
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
          )}
        >
          <Users className="h-4 w-4" />
          Faculty Registry
        </button>
        <button
          onClick={() => setActiveTab('announcements')}
          className={cn(
            "px-6 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2.5",
            activeTab === 'announcements'
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
          )}
        >
          <Megaphone className="h-4 w-4" />
          System Announcements
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'faculty' ? (
          <motion.div
            key="faculty-tab"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
            className="space-y-8"
          >
            {/* Stats Overview */}
            <div className="grid gap-6 md:grid-cols-3">
              <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
                <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">Total Faculty</p>
                <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">{teachers.length}</h3>
                <p className="text-slate-400 dark:text-slate-500 text-[11px] mt-2 font-medium italic truncate">Registered educators</p>
              </div>
              <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
                <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">Active Status</p>
                <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tracking-tight">
                  {teachers.filter(t => !t.isBanned).length}
                </h3>
                <p className="text-slate-400 dark:text-slate-500 text-[11px] mt-2 font-medium italic">Verified access</p>
              </div>
              <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
                <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">Restricted</p>
                <h3 className="text-2xl font-bold text-red-600 dark:text-red-400 tracking-tight">
                  {teachers.filter(t => t.isBanned).length}
                </h3>
                <p className="text-slate-400 dark:text-slate-500 text-[11px] mt-2 font-medium italic">Banned accounts</p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3 bg-slate-50/50 dark:bg-slate-800/30">
                <Search className="h-5 w-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search faculty by name or institutional email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-medium text-slate-600 dark:text-slate-300 placeholder:text-slate-300 dark:placeholder:text-slate-600 italic"
                />
              </div>

              {loading ? (
                <div className="flex h-64 items-center justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[11px] text-slate-400 dark:text-slate-500 uppercase tracking-widest bg-slate-50/50 dark:bg-slate-800/30">
                        <th className="px-6 py-3 font-bold border-b border-slate-100 dark:border-slate-800">Faculty Member</th>
                        <th className="px-6 py-3 font-bold border-b border-slate-100 dark:border-slate-800">Contact Details</th>
                        <th className="px-6 py-3 font-bold border-b border-slate-100 dark:border-slate-800">Registration</th>
                        <th className="px-6 py-3 font-bold border-b border-slate-100 dark:border-slate-800">Permission</th>
                        <th className="px-6 py-3 font-bold border-b border-slate-100 dark:border-slate-800 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                      <AnimatePresence mode="popLayout">
                        {filteredTeachers.map((teacher, idx) => (
                          <motion.tr 
                            key={teacher.uid}
                            layout
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ delay: idx * 0.02 }}
                            className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group"
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className={cn(
                                  "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-sm transition-colors ring-2 ring-transparent group-hover:ring-indigo-500/10 overflow-hidden",
                                  teacher.isBanned 
                                    ? "bg-red-50 dark:bg-red-900/20 text-red-600" 
                                    : "bg-slate-50 dark:bg-slate-800 text-slate-400 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/20 group-hover:text-indigo-600"
                                )}>
                                  {teacher.photoURL ? (
                                    <img src={teacher.photoURL} alt={teacher.name} className="w-full h-full object-cover" />
                                  ) : (
                                    teacher.name.charAt(0)
                                  )}
                                </div>
                                <div>
                                  <p className="font-bold text-slate-700 dark:text-slate-200 tracking-tight">{teacher.name}</p>
                                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium uppercase tracking-tighter">Educator Rank</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 underline decoration-slate-200 dark:decoration-slate-800 underline-offset-4">
                                <Mail className="h-3 w-3" />
                                <span className="text-xs font-medium">{teacher.email}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500">
                                <Calendar className="h-3 w-3" />
                                <span className="text-xs font-medium italic">{new Date(teacher.createdAt).toLocaleDateString()}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              {teacher.isBanned ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-[10px] font-bold uppercase tracking-tight border border-red-100 dark:border-red-800/50">
                                  <XCircle className="h-3 w-3" />
                                  Revoked
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold uppercase tracking-tight border border-emerald-100 dark:border-emerald-800/50">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Authenticated
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                                <button 
                                  onClick={() => toggleBan(teacher)}
                                  className={cn(
                                    "flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all shadow-sm",
                                    teacher.isBanned 
                                      ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-600/20" 
                                      : "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40 border border-amber-100 dark:border-amber-800/50"
                                  )}
                                >
                                  {teacher.isBanned ? <ShieldCheck className="h-3 w-3" /> : <Ban className="h-3 w-3" />}
                                  {teacher.isBanned ? "Restore" : "Revoke Access"}
                                </button>
                                <button 
                                  onClick={() => setTeacherToDelete(teacher)}
                                  className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                    </tbody>
                  </table>
                </div>
              )}

              {filteredTeachers.length === 0 && !loading && (
                <div className="p-12 text-center">
                  <AlertTriangle className="h-10 w-10 text-slate-200 dark:text-slate-800 mx-auto mb-4" />
                  <p className="text-slate-400 dark:text-slate-500 italic font-medium">No faculty records found matching your query.</p>
                </div>
              )}
            </div>

            <DeleteModal
              isOpen={!!teacherToDelete}
              onClose={() => setTeacherToDelete(null)}
              onConfirm={handleDeleteTeacher}
              title="Purge Teacher Profile"
              message={`Are you sure you want to permanently delete ${teacherToDelete?.name}'s account? This action will remove their profile and all associated data from the system. This cannot be undone.`}
              isDeleting={!!isDeleting}
            />
          </motion.div>
        ) : (
          <motion.div
            key="announcements-tab"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fade-in"
          >
            {/* Compose Panel */}
            <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-indigo-500" />
                  Draft Global Announcement
                </h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                  Compose announcements that instant notify and sound on target recipient screens.
                </p>
              </div>

              <form onSubmit={handlePublishAnnouncement} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Announcement Title
                  </label>
                  <input
                    type="text"
                    required
                    value={announcementTitle}
                    onChange={(e) => setAnnouncementTitle(e.target.value)}
                    placeholder="e.g. Schedule Maintenance, Holiday Update"
                    className="w-full text-sm font-semibold border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 focus:bg-white dark:bg-slate-950/45 dark:focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 px-4 py-3 text-slate-900 dark:text-white transition-all placeholder:text-slate-405"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Detailed Message
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={announcementMessage}
                    onChange={(e) => setAnnouncementMessage(e.target.value)}
                    placeholder="Write detailed system release logs, schedule, or institutional announcement text here..."
                    className="w-full text-xs font-medium border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 focus:bg-white dark:bg-slate-950/45 dark:focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 px-4 py-3 text-slate-900 dark:text-white transition-all placeholder:text-slate-405 leading-relaxed resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Target Broadcast Segment
                  </label>
                  <div className="grid grid-cols-3 gap-2.5">
                    {(['all', 'teacher', 'student'] as const).map((segment) => (
                      <button
                        key={segment}
                        type="button"
                        onClick={() => setTargetAudience(segment)}
                        className={cn(
                          "py-2 rounded-xl text-xs font-bold uppercase tracking-tight transition-all border flex flex-col items-center justify-center gap-1",
                          targetAudience === segment
                            ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/10"
                            : "bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 border-slate-200 dark:border-slate-850 text-slate-600 dark:text-slate-400"
                        )}
                      >
                        {segment === 'all' && (
                          <>
                            <Users className="h-3.5 w-3.5" />
                            <span>Everyone</span>
                          </>
                        )}
                        {segment === 'teacher' && (
                          <>
                            <ShieldAlert className="h-3.5 w-3.5" />
                            <span>Faculty</span>
                          </>
                        )}
                        {segment === 'student' && (
                          <>
                            <GraduationCap className="h-3.5 w-3.5" />
                            <span>Students</span>
                          </>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isPublishing || !announcementTitle.trim() || !announcementMessage.trim()}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-indigo-700 transition-all shadow-md shadow-indigo-600/10 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:-translate-y-0 cursor-pointer"
                >
                  {isPublishing ? (
                    <>
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Broadcasting Alerts...</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" />
                      <span>Publish Announcement</span>
                    </>
                  )}
                </button>

                <AnimatePresence>
                  {publishSuccess && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="p-3 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/50 rounded-xl text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2"
                    >
                      <Check className="h-4 w-4 border-2 border-emerald-500 rounded-full flex items-center justify-center" />
                      <span>Announcement successfully dispatched system-wide!</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </form>
            </div>

            {/* History Panel */}
            <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6 flex flex-col max-h-[640px]">
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <Clock className="h-4 w-4 text-indigo-505" />
                  Broadcast History Feed
                </h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                  Previous global alerts and notifications stored in your archive.
                </p>
              </div>

              <div className="flex-1 overflow-y-auto pr-1 space-y-4 custom-scrollbar">
                {announcementsLoading ? (
                  <div className="py-20 text-center">
                    <div className="h-7 w-7 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
                  </div>
                ) : announcements.length === 0 ? (
                  <div className="text-center py-20 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-xl p-8 bg-slate-50/50 dark:bg-slate-900/10">
                    <Megaphone className="h-8 w-8 text-slate-200 dark:text-slate-850 mx-auto mb-3" />
                    <p className="text-xs text-slate-400 dark:text-slate-550 font-medium italic">
                      No broadcast entries archived. Write your first above!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    {announcements.map((item) => (
                      <div 
                        key={item.id} 
                        className="group relative bg-slate-50/50 dark:bg-slate-950/20 border border-slate-150 dark:border-slate-850 rounded-xl p-4 hover:border-slate-300 dark:hover:border-slate-800 transition-all flex justify-between gap-4"
                      >
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={cn(
                              "px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded border",
                              item.relatedId === 'announcement_teacher' 
                                ? "bg-amber-50 border-amber-200 text-amber-600 dark:bg-amber-900/10 dark:border-amber-800/40"
                                : item.relatedId === 'announcement_student'
                                ? "bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-900/10 dark:border-blue-800/40"
                                : "bg-indigo-50 border-indigo-205 text-indigo-600 dark:bg-indigo-900/10 dark:border-indigo-800/40"
                            )}>
                              {item.relatedId === 'announcement_teacher' 
                                ? "Teachers Only" 
                                : item.relatedId === 'announcement_student' 
                                ? "Students Only" 
                                : "Everyone"
                              }
                            </span>
                            <span className="text-[10px] text-slate-400 font-bold dark:text-slate-600">
                              {new Date(item.createdAt).toLocaleString()}
                            </span>
                          </div>

                          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-150 leading-snug">
                            {item.title}
                          </h4>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed break-words font-medium">
                            {item.message}
                          </p>
                        </div>

                        <div className="flex-shrink-0 flex items-start">
                          <button
                            type="button"
                            onClick={() => setAnnouncementToDelete(item)}
                            className="p-1 px-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-md transition-all sm:opacity-0 group-hover:opacity-100"
                            title="Remove from history"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <DeleteModal
              isOpen={!!announcementToDelete}
              onClose={() => setAnnouncementToDelete(null)}
              onConfirm={handleDeleteAnnouncement}
              title="Delete Announcement"
              message={`Are you sure you want to permanently delete "${announcementToDelete?.title}" from history? This deletes the historical archive view of this broadcast.`}
              isDeleting={isDeletingAnnouncement}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
