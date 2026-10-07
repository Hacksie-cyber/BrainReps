import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { collection, doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { useAuth } from './AuthContext';
import { UserPresence } from '../types';

export function getActivityName(pathname: string): string {
  if (pathname.startsWith('/student/quiz/')) return 'Taking an Assessment';
  if (pathname === '/student/quizzes') return 'Browsing Reps Library';
  if (pathname === '/student/performance') return 'Reviewing Performance & Analytics';
  if (pathname === '/student/assistant') return 'Interacting with Neural AI';
  if (pathname === '/student/roster') return 'Viewing Class Roster';
  if (pathname === '/student/profile') return 'Updating Profile';
  if (pathname === '/student') return 'In Student Dashboard';

  if (pathname === '/teacher/create') return 'Authoring Assessment';
  if (pathname.startsWith('/teacher/edit/')) return 'Editing Assessment';
  if (pathname === '/teacher/assessments') return 'Managing Assessments Inventory';
  if (pathname === '/teacher/students') return 'Reviewing Student Roster';
  if (pathname === '/teacher/analytics') return 'Analyzing Cohort Metrics';
  if (pathname === '/teacher/handouts') return 'Managing Study Materials';
  if (pathname === '/teacher/active-users') return 'Monitoring Live Presence';
  if (pathname.startsWith('/teacher/quiz/')) return 'Reviewing Quiz Results';
  if (pathname.includes('/present')) return 'Hosting Slide Presentation';
  if (pathname === '/teacher') return 'In Teacher Dashboard';

  return 'Active on Website';
}

/**
 * Hook to publish current user's presence heartbeat into Firestore.
 */
export function usePresencePublisher() {
  const { user, profile } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (!user || !profile || profile.isBanned) return;

    let heartbeatTimer: any = null;

    const sendHeartbeat = async (status: 'online' | 'idle' | 'offline' = 'online') => {
      try {
        const presenceDoc: UserPresence = {
          uid: user.uid,
          name: profile.name || user.displayName || 'Anonymous User',
          email: profile.email || user.email || '',
          role: profile.role,
          photoURL: profile.photoURL || user.photoURL || '',
          lastSeen: new Date().toISOString(),
          status,
          currentPath: location.pathname,
          currentActivity: getActivityName(location.pathname),
        };

        await setDoc(doc(db, 'presence', user.uid), presenceDoc, { merge: true });
      } catch (err) {
        // Presence updates fail silently to not interrupt critical user flows
      }
    };

    // Initial broadcast on route change or mount
    sendHeartbeat(document.visibilityState === 'visible' ? 'online' : 'idle');

    // Recurring heartbeat every 25 seconds
    heartbeatTimer = setInterval(() => {
      sendHeartbeat(document.visibilityState === 'visible' ? 'online' : 'idle');
    }, 25000);

    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === 'visible';
      sendHeartbeat(isVisible ? 'online' : 'idle');
    };

    const handleBeforeUnload = () => {
      // Best-effort offline mark
      sendHeartbeat('offline');
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [user, profile, location.pathname]);
}

/**
 * Hook to subscribe to all currently active users in real time.
 * Considers a user active if their lastSeen was within the last 90 seconds
 * and status is 'online' or 'idle'.
 */
export function useActiveUsers() {
  const [activeUsers, setActiveUsers] = useState<UserPresence[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const presenceRef = collection(db, 'presence');
    const unsubscribe = onSnapshot(presenceRef, (snapshot) => {
      const now = Date.now();
      const users: UserPresence[] = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as UserPresence;
        if (!data || !data.lastSeen) return;

        const lastSeenTime = new Date(data.lastSeen).getTime();
        const diffMs = now - lastSeenTime;

        // Active if seen within 90 seconds (1.5 minutes) and not explicitly marked offline
        if (diffMs <= 90000 && data.status !== 'offline') {
          users.push(data);
        }
      });

      // Sort by most recently seen
      users.sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime());
      setActiveUsers(users);
      setLoading(false);
    }, (error) => {
      console.error("Error subscribing to presence:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const studentCount = activeUsers.filter(u => u.role === 'student').length;
  const teacherCount = activeUsers.filter(u => u.role === 'teacher' || u.role === 'admin').length;
  const quizParticipantCount = activeUsers.filter(u => u.currentPath?.startsWith('/student/quiz/')).length;

  return {
    activeUsers,
    onlineCount: activeUsers.length,
    studentCount,
    teacherCount,
    quizParticipantCount,
    loading,
  };
}
