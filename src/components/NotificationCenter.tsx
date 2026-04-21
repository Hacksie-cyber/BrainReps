import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { Notification } from '../types';
import { Bell, X, Check, Trash2, MailOpen, AlertCircle, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatDeadline } from '../lib/utils';

export default function NotificationCenter() {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;

    // Use a simple query to avoid the need for a composite index
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', profile.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
      // Sort client-side to avoid composite index requirement
      data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setNotifications(data);
      setLoading(false);
    }, (error) => {
      console.error("Notification listener error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { isRead: true });
    } catch (error) {
      console.error(error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const batch = writeBatch(db);
      notifications.filter(n => !n.isRead).forEach(n => {
        batch.update(doc(db, 'notifications', n.id), { isRead: true });
      });
      await batch.commit();
    } catch (error) {
      console.error(error);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'notifications', id));
    } catch (error) {
      console.error(error);
    }
  };

  const clearAll = async () => {
    try {
      const batch = writeBatch(db);
      notifications.forEach(n => {
        batch.delete(doc(db, 'notifications', n.id));
      });
      await batch.commit();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-all active:scale-95"
        title="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white ring-2 ring-white dark:ring-slate-900 animate-in zoom-in">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-40 bg-transparent"
            />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute left-0 lg:left-auto lg:right-0 mt-2 w-[calc(100vw-2rem)] sm:w-80 md:w-96 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 z-50 overflow-hidden"
            >
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-tighter">Notification Center</h3>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Monitoring academic synchronization</p>
                </div>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="p-1.5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-md transition-colors"
                      title="Mark all as read"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button
                      onClick={clearAll}
                      className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                      title="Clear all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                {loading ? (
                  <div className="p-10 text-center">
                    <div className="h-6 w-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="p-12 text-center flex flex-col items-center">
                    <Bell className="w-10 h-10 text-slate-200 dark:text-slate-800 mb-3" />
                    <p className="text-xs text-slate-400 italic">No alerts recorded at this time.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
                    {notifications.map((n) => (
                      <div 
                        key={n.id} 
                        className={cn(
                          "p-4 flex gap-3 transition-colors group",
                          !n.isRead ? "bg-indigo-50/30 dark:bg-indigo-900/10" : "bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        )}
                      >
                        <div className={cn(
                          "w-8 h-8 rounded-xl flex items-center justify-center shrink-0",
                          n.type === 'assignment' ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" : "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
                        )}>
                          {n.type === 'assignment' ? <BookOpen className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                             <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 leading-tight uppercase truncate">{n.title}</h4>
                             {!n.isRead && (
                               <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full shrink-0 mt-1" />
                             )}
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-1 leading-relaxed">
                            {n.message}
                          </p>
                          <p className="text-[9px] text-slate-400 dark:text-slate-600 font-bold mt-2 uppercase">
                            {formatDeadline(n.createdAt)}
                          </p>
                        </div>
                        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                           {!n.isRead && (
                             <button
                               onClick={() => markAsRead(n.id)}
                               className="p-1 px-2.5 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-md text-[8px] font-black uppercase tracking-tighter transition-colors flex items-center gap-1"
                             >
                                <MailOpen className="w-2.5 h-2.5" /> Read
                             </button>
                           )}
                           <button
                             onClick={() => deleteNotification(n.id)}
                             className="p-1 px-2.5 hover:bg-red-100 dark:hover:bg-red-900/50 text-slate-400 hover:text-red-600 rounded-md text-[8px] font-black uppercase tracking-tighter transition-colors flex items-center gap-1"
                           >
                              <X className="w-2.5 h-2.5" /> Clear
                           </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {notifications.length > 0 && (
                 <div className="p-3 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 text-center">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Digital Academy Alert System v1.0</p>
                 </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
