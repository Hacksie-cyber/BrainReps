import { useEffect, useState, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { collection, doc, setDoc, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { useAuth } from './AuthContext';
import { UserPresence, UserRole } from '../types';

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

// Presence active window: users seen within last 10 minutes (600,000 ms)
export const PRESENCE_ACTIVE_WINDOW_MS = 600000;
// Fresh online window (under 2.5 min = online; over 2.5 min = idle)
export const RECENT_ACTIVE_WINDOW_MS = 150000;
// Cache TTL for polling/background views: 30 seconds
const CACHE_TTL_MS = 30000;
// Foreground heartbeat: 25 seconds
const FOREGROUND_HEARTBEAT_MS = 25000;
// Background heartbeat (idle): 50 seconds (ensures background tabs remain visible as idle)
const BACKGROUND_HEARTBEAT_MS = 50000;

export interface PresenceState {
  activeUsers: UserPresence[];
  onlineCount: number;
  studentCount: number;
  teacherCount: number;
  quizParticipantCount: number;
  loading: boolean;
  lastRefreshedAt: number;
  isAutoRefreshing: boolean;
}

export function parseLastSeenTime(lastSeen: any): number {
  if (!lastSeen) return 0;
  if (typeof lastSeen === 'number') return lastSeen;
  if (typeof lastSeen?.toMillis === 'function') return lastSeen.toMillis();
  if (typeof lastSeen?.toDate === 'function') return lastSeen.toDate().getTime();
  if (typeof lastSeen === 'object' && typeof lastSeen.seconds === 'number') {
    return lastSeen.seconds * 1000;
  }
  const parsed = new Date(lastSeen).getTime();
  return isNaN(parsed) ? 0 : parsed;
}

export function processPresenceSnapshot(snapshotDocs: any[]): UserPresence[] {
  const currentTime = Date.now();
  const users: UserPresence[] = [];

  snapshotDocs.forEach((docSnap) => {
    const rawData = (typeof docSnap.data === 'function' ? docSnap.data() : docSnap) as any;
    if (!rawData) return;

    const lastSeenTime = parseLastSeenTime(rawData.lastSeen);
    if (!lastSeenTime) return;

    const diffMs = currentTime - lastSeenTime;

    // Accounts for clock drift (if negative, student machine clock is slightly ahead)
    const isWithinActiveWindow = diffMs <= PRESENCE_ACTIVE_WINDOW_MS;
    const isRecentlyActive = diffMs <= RECENT_ACTIVE_WINDOW_MS;

    // Only discard if explicitly marked offline AND not recently seen
    const isExplicitlyOffline = rawData.status === 'offline' && !isRecentlyActive;

    if (isWithinActiveWindow && !isExplicitlyOffline) {
      // Normalize role and status
      const roleStr = String(rawData.role || 'student').toLowerCase().trim();
      const normalizedRole: UserRole = 
        (roleStr === 'teacher' || roleStr === 'admin') ? (roleStr as UserRole) : 'student';

      // Intelligently compute status: if in background or seen > 2.5m ago, status is idle; else online
      const computedStatus: 'online' | 'idle' | 'offline' = 
        (diffMs > RECENT_ACTIVE_WINDOW_MS || rawData.status === 'idle') ? 'idle' : 'online';

      users.push({
        uid: rawData.uid || docSnap.id,
        name: rawData.name || rawData.displayName || (rawData.email ? rawData.email.split('@')[0] : 'Learner'),
        email: rawData.email || '',
        role: normalizedRole,
        photoURL: rawData.photoURL || '',
        lastSeen: new Date(lastSeenTime).toISOString(),
        status: computedStatus,
        currentPath: rawData.currentPath || '/',
        currentActivity: rawData.currentActivity || getActivityName(rawData.currentPath || '/'),
      });
    }
  });

  // Sort by most recently active
  users.sort((a, b) => parseLastSeenTime(b.lastSeen) - parseLastSeenTime(a.lastSeen));
  return users;
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
  private liveUnsubscribe: (() => void) | null = null;
  private liveSubscriberCount = 0;

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);

    // If first subscriber, start polling
    if (this.listeners.size === 1 && this.liveSubscriberCount === 0) {
      this.startPolling();
    }

    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0 && this.liveSubscriberCount === 0) {
        this.stopPolling();
      }
    };
  }

  public subscribeLive(listener: () => void): () => void {
    this.listeners.add(listener);
    this.liveSubscriberCount++;

    if (this.liveSubscriberCount === 1) {
      // Start real-time Firestore listener for Active Users view
      this.stopPolling();
      const presenceRef = collection(db, 'presence');
      this.liveUnsubscribe = onSnapshot(presenceRef, (snapshot) => {
        const users = processPresenceSnapshot(snapshot.docs);
        this.updateStateWithUsers(users);
      }, (err) => {
        console.warn('[Presence] Live listener error, falling back to polling:', err);
        this.startPolling();
      });
    }

    return () => {
      this.listeners.delete(listener);
      this.liveSubscriberCount = Math.max(0, this.liveSubscriberCount - 1);

      if (this.liveSubscriberCount === 0) {
        if (this.liveUnsubscribe) {
          this.liveUnsubscribe();
          this.liveUnsubscribe = null;
        }
        if (this.listeners.size > 0) {
          this.startPolling();
        }
      }
    };
  }

  public getState(): PresenceState {
    return this.state;
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }

  private updateStateWithUsers(users: UserPresence[]) {
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
      lastRefreshedAt: Date.now(),
      isAutoRefreshing: this.state.isAutoRefreshing,
    };

    this.notify();
  }

  public async fetch(force = false): Promise<void> {
    const now = Date.now();
    if (!force && now - this.state.lastRefreshedAt < CACHE_TTL_MS && !this.state.loading) {
      return;
    }

    if (this.isFetching) return;
    this.isFetching = true;

    try {
      const snapshot = await getDocs(collection(db, 'presence'));
      const users = processPresenceSnapshot(snapshot.docs);
      this.updateStateWithUsers(users);
    } catch (err) {
      console.warn('[Presence] Fetch error:', err);
      this.state = { ...this.state, loading: false };
      this.notify();
    } finally {
      this.isFetching = false;
    }
  }

  public async manualRefresh(): Promise<void> {
    await this.fetch(true);
  }

  public setAutoRefresh(enabled: boolean) {
    this.state.isAutoRefreshing = enabled;
    if (enabled && this.liveSubscriberCount === 0) {
      this.startPolling();
    } else if (!enabled) {
      this.stopPolling();
    }
    this.notify();
  }

  private startPolling() {
    this.stopPolling();
    this.fetch();

    this.pollTimer = setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      if (!this.state.isAutoRefreshing) return;
      this.fetch(true);
    }, CACHE_TTL_MS);
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
 * Hook to continuously publish current user's presence heartbeat into Firestore.
 * - Initial heartbeat immediately upon auth resolution + retry at 2.5s
 * - Foreground continuous 25s heartbeat (online)
 * - Background 50s heartbeat (idle) so background tabs stay registered as idle!
 * - Route navigation reporter (throttled to 2.5s)
 * - Avoids premature 'offline' writes on tab reload or navigation
 */
export function usePresencePublisher() {
  const { user, profile } = useAuth();
  const location = useLocation();

  const currentPathRef = useRef(location.pathname);
  currentPathRef.current = location.pathname;

  const lastSentTimeRef = useRef<number>(0);

  const sendHeartbeat = useCallback(async (statusOverride?: 'online' | 'idle' | 'offline') => {
    if (!user) return;
    if (profile?.isBanned) return;

    try {
      const isVisible = document.visibilityState === 'visible';
      const status: 'online' | 'idle' | 'offline' = 
        statusOverride ?? (isVisible ? 'online' : 'idle');

      const path = currentPathRef.current || '/';
      const rawRole = (profile?.role || 'student').toLowerCase();
      const normalizedRole: UserRole = 
        (rawRole === 'teacher' || rawRole === 'admin') ? (rawRole as UserRole) : 'student';

      const userName = 
        profile?.name || 
        user.displayName || 
        (user.email ? user.email.split('@')[0] : 'Learner');

      const presenceDoc: UserPresence = {
        uid: user.uid,
        name: userName,
        email: profile?.email || user.email || '',
        role: normalizedRole,
        photoURL: profile?.photoURL || user.photoURL || '',
        lastSeen: new Date().toISOString(),
        status,
        currentPath: path,
        currentActivity: getActivityName(path),
      };

      lastSentTimeRef.current = Date.now();
      await setDoc(doc(db, 'presence', user.uid), presenceDoc, { merge: true });
    } catch (err) {
      console.error('[Presence] Heartbeat error:', err);
    }
  }, [user, profile]);

  // Persistent heartbeat loop
  useEffect(() => {
    if (!user) return;

    // 1. Send initial heartbeat immediately
    sendHeartbeat();

    // 2. Retry after 2.5s to ensure document exists even if initial connection took a moment
    const retryTimeout = setTimeout(() => {
      sendHeartbeat();
    }, 2500);

    // 3. Foreground / background recurring heartbeat
    const intervalTimer = setInterval(() => {
      const isVisible = document.visibilityState === 'visible';
      sendHeartbeat(isVisible ? 'online' : 'idle');
    }, FOREGROUND_HEARTBEAT_MS);

    // 4. Update status when tab visibility changes
    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === 'visible';
      sendHeartbeat(isVisible ? 'online' : 'idle');
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearTimeout(retryTimeout);
      clearInterval(intervalTimer);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, sendHeartbeat]);

  // Route navigation reporter
  useEffect(() => {
    if (!user) return;

    const timeSinceLast = Date.now() - lastSentTimeRef.current;
    if (timeSinceLast > 2500) {
      sendHeartbeat();
    }
  }, [location.pathname, user, sendHeartbeat]);
}

interface ActiveUsersOptions {
  enabled?: boolean;
  live?: boolean;
}

/**
 * Hook to consume active users.
 * - Options:
 *   - enabled: defaults to checking teacher/admin role (0 reads for students!)
 *   - live: when true (in Active Users Tab), attaches live real-time radar listener!
 *           when false, uses shared 30s cache to optimize Firestore reads.
 */
export function useActiveUsers(options: boolean | ActiveUsersOptions = true) {
  const { profile } = useAuth();

  const enabled = typeof options === 'boolean' ? options : options.enabled ?? true;
  const live = typeof options === 'object' ? Boolean(options.live) : false;

  const isAuthorized = enabled && Boolean(
    profile && (profile.role === 'teacher' || profile.role === 'admin' || profile.email === 'bamuyahacksie@gmail.com')
  );

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

    const listener = () => {
      setState(presenceManager.getState());
    };

    // If live is requested (on /teacher/active-users), attach live listener
    const unsubscribe = live
      ? presenceManager.subscribeLive(listener)
      : presenceManager.subscribe(listener);

    setState(presenceManager.getState());

    return () => {
      unsubscribe();
    };
  }, [isAuthorized, live]);

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
