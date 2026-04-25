import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { UserProfile } from '../types';
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
  AlertTriangle
} from 'lucide-react';
import { cn } from '../lib/utils';
import DeleteModal from './DeleteModal';

export default function AdminManagement() {
  const { profile } = useAuth();
  const [teachers, setTeachers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [teacherToDelete, setTeacherToDelete] = useState<UserProfile | null>(null);

  useEffect(() => {
    fetchTeachers();
  }, []);

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

  const filteredTeachers = teachers.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-3">
            <ShieldAlert className="h-6 w-6 text-indigo-600" />
            Faculty Control Center
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium tracking-tight">
            High-level oversight of registered teacher accounts and access permissions.
          </p>
        </div>
        <button 
          onClick={fetchTeachers}
          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95 shadow-sm"
        >
          <RefreshCcw className="h-4 w-4" />
          Refresh Registry
        </button>
      </header>

      {/* Stats Overview */}
      <div className="grid gap-6 md:grid-cols-3">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
          <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">Total Faculty</p>
          <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">{teachers.length}</h3>
          <p className="text-slate-400 dark:text-slate-500 text-[11px] mt-2 font-medium italic italic truncate">Registered educators</p>
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
    </div>
  );
}
