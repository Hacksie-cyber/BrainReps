import { useEffect, useState, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { collection, doc, setDoc, getDocs, query, where, limit } from 'firebase/firestore';
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

// Presence active window: users seen within last 2.5 minutes (150s)
const PRESENCE_ACTIVE_WINDOW_MS = 150000;
// Cache TTL: 45 seconds (navigation within 45s incurs 0 Firestore reads)
const CACHE_TTL_MS = 45000;
// Polling interval for active teacher view: 60 seconds
const POLL_INTERVAL_MS = 60000;
// Heartbeat interval for publishing: 60 seconds (reduced from 25s)
const HEARTBEAT_INTERVAL_MS = 60000;

interface PresenceState {
  activeUsers: UserPresence[];
  onlineCount: number;
  studentCount: number;
  teacherCount: number;
  quizParticipantCount: number;
  loading: boolean;
  lastRefreshedAt: number;
  isAutoRefreshing: boolean;
}

class PresenceManager {
  private state: PresenceState = {
    activeUsers: [],
    onlineCount: 0,
    studentCount: 0,
    teacherCount: 0,
    quizParticipantCount: 0,
    loading: true,
    lastRefreshedAt: 0,
    isAutoRefreshing: true,
  };

  private listeners: Set<() => void> = new Set();
  private pollTimer: any = null;
  private isFetching = false;
  private lastManualRefresh = 0;

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);

    // If this is the first subscriber, initiate polling
    if (this.listeners.size === 1) {
      this.startPolling();
    }

    return () => {
      this.listeners.delete(listener);
      // When no more components are subscribed, pause polling to conserve Firestore resources
      if (this.listeners.size === 0) {
        this.stopPolling();
      }
    };
  }

  public getState(): PresenceState {
    return this.state;
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }

  public async fetch(force = false): Promise<void> {
    const now = Date.now();
    // Use cached data if fresh within TTL and not forced
    if (!force && now - this.state.lastRefreshedAt < CACHE_TTL_MS && !this.state.loading) {
      return;
    }

    if (this.isFetching) return;
    this.isFetching = true;

    try {
      // Resource-efficient targeted query:
      // Only read users who are currently 'online' or 'idle' (skips all historical offline docs)
      // Capped at 60 to prevent unbounded read costs
      const q = query(
        collection(db, 'presence'),
        where('status', 'in', ['online', 'idle']),
        limit(60)
      );

      const snapshot = await getDocs(q);
      const currentTime = Date.now();
      const users: UserPresence[] = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as UserPresence;
        if (!data || !data.lastSeen) return;

        const lastSeenTime = new Date(data.lastSeen).getTime();
        const diffMs = currentTime - lastSeenTime;

        // Discard any entries that exceeded the 2.5-minute cutoff window
        if (diffMs <= PRESENCE_ACTIVE_WINDOW_MS && data.status !== 'offline') {
          users.push(data);
        }
      });

      // Sort by most recently active
      users.sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime());

      const studentCount = users.filter((u) => u.role === 'student').length;
      const teacherCount = users.filter((u) => u.role === 'teacher' || u.role === 'admin').length;
      const quizParticipantCount = users.filter((u) => u.currentPath?.startsWith('/student/quiz/')).length;

      this.state = {
        activeUsers: users,
        onlineCount: users.length,
        studentCount,
        teacherCount,
        quizParticipantCount,
        loading: false,
        lastRefreshedAt: currentTime,
        isAutoRefreshing: this.state.isAutoRefreshing,
      };

      this.notify();
    } catch (err) {
      console.warn('Optimized presence fetch error:', err);
      this.state = {
        ...this.state,
        loading: false,
      };
      this.notify();
    } finally {
      this.isFetching = false;
    }
  }

  public async manualRefresh(): Promise<void> {
    const now = Date.now();
    // Debounce manual refresh to avoid spamming Firestore reads (at most once every 5s)
    if (now - this.lastManualRefresh < 5000) return;
    this.lastManualRefresh = now;
    await this.fetch(true);
  }

  public setAutoRefresh(enabled: boolean) {
    this.state.isAutoRefreshing = enabled;
    if (enabled) {
      this.startPolling();
    } else {
      this.stopPolling();
    }
    this.notify();
  }

  private startPolling() {
    this.stopPolling();
    // Perform initial fetch if stale
    this.fetch();

    this.pollTimer = setInterval(() => {
      // Don't poll if the tab is hidden or minimized (saves reads while tab is in background)
      if (document.visibilityState === 'hidden') return;
      if (!this.state.isAutoRefreshing) return;
      this.fetch(true);
    }, POLL_INTERVAL_MS);
  }

  private stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  public handleVisibilityChange() {
    if (document.visibilityState === 'visible' && this.listeners.size > 0 && this.state.isAutoRefreshing) {
      const now = Date.now();
      // If data is older than TTL when tab becomes visible, refresh once
      if (now - this.state.lastRefreshedAt >= CACHE_TTL_MS) {
        this.fetch(true);
      }
    }
  }
}

const presenceManager = new PresenceManager();

if (typeof window !== 'undefined') {
  window.addEventListener('visibilitychange', () => {
    presenceManager.handleVisibilityChange();
  });
}

/**
 * Hook to publish current user's presence heartbeat into Firestore.
 * Highly resource-optimized:
 * - Heartbeat interval: 60s (was 25s, reducing writes by 60%)
 * - Pauses recurring writes when tab is hidden
 * - Throttles rapid route switching writes
 */
export function usePresencePublisher() {
  const { user, profile } = useAuth();
  const location = useLocation();

  const lastSentPathRef = useRef<string>('');
  const lastPathSentTimeRef = useRef<number>(0);

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

        lastSentPathRef.current = location.pathname;
        lastPathSentTimeRef.current = Date.now();

        await setDoc(doc(db, 'presence', user.uid), presenceDoc, { merge: true });
      } catch (err) {
        // Fail silently
      }
    };

    // Path change check:
    // Only send write if user navigated to a critical path (like a quiz) OR
    // at least 25 seconds have passed since last path report.
    // Otherwise, wait for the recurring 60s heartbeat to update the path.
    const isQuizSession = location.pathname.startsWith('/student/quiz/');
    const timeSinceLastPath = Date.now() - lastPathSentTimeRef.current;

    if (
      !lastSentPathRef.current ||
      isQuizSession ||
      timeSinceLastPath > 25000
    ) {
      sendHeartbeat(document.visibilityState === 'visible' ? 'online' : 'idle');
    }

    // Set recurring 60s heartbeat
    heartbeatTimer = setInterval(() => {
      // Pause sending heartbeats while tab is hidden in background
      if (document.visibilityState === 'hidden') return;
      sendHeartbeat('online');
    }, HEARTBEAT_INTERVAL_MS);

    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === 'visible';
      // When tab goes into background, send 1 'idle' notice and pause interval
      sendHeartbeat(isVisible ? 'online' : 'idle');
    };

    const handleBeforeUnload = () => {
      // Best-effort offline marker
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
 * Hook to consume active users.
 * Optimized with:
 * 1. Global in-memory cache with 45s TTL (eliminates duplicate reads across components)
 * 2. Role-gated: students incur 0 reads
 * 3. 60s targeted polling instead of unthrottled onSnapshot firehose
 * 4. Background-tab pause to conserve reads
 * 5. Query filtered by status and limited to 60 docs
 */
export function useActiveUsers(enabled = true) {
  const { profile } = useAuth();
  
  // By default, only teachers and admins need active users tracking
  const isAuthorized = enabled && (profile?.role === 'teacher' || profile?.role === 'admin' || profile?.email === 'bamuyahacksie@gmail.com');

  const [state, setState] = useState<PresenceState>(() => {
    if (!isAuthorized) {
      return {
        activeUsers: [],
        onlineCount: 0,
        studentCount: 0,
        teacherCount: 0,
        quizParticipantCount: 0,
        loading: false,
        lastRefreshedAt: 0,
        isAutoRefreshing: true,
      };
    }
    return presenceManager.getState();
  });

  useEffect(() => {
    if (!isAuthorized) return;

    const unsubscribe = presenceManager.subscribe(() => {
      setState(presenceManager.getState());
    });

    // Sync initial state
    setState(presenceManager.getState());

    return () => {
      unsubscribe();
    };
  }, [isAuthorized]);

  const refresh = useCallback(async () => {
    if (!isAuthorized) return;
    await presenceManager.manualRefresh();
  }, [isAuthorized]);

  const toggleAutoRefresh = useCallback((autoRefreshEnabled: boolean) => {
    presenceManager.setAutoRefresh(autoRefreshEnabled);
  }, []);

  return {
    ...state,
    refresh,
    toggleAutoRefresh,
  };
}
