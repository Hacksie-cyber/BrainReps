import { Notification } from '../types';

const NOTIF_EVENT = 'local-notifications-updated';

export function getLocalNotifications(userId: string): Notification[] {
  try {
    const raw = localStorage.getItem(`local_notifications_${userId}`);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Failed to parse local notifications", e);
    return [];
  }
}

export function saveLocalNotifications(userId: string, notifications: Notification[]) {
  try {
    localStorage.setItem(`local_notifications_${userId}`, JSON.stringify(notifications));
    window.dispatchEvent(new CustomEvent(NOTIF_EVENT));
  } catch (e) {
    console.error("Failed to save local notifications", e);
  }
}

export function addLocalNotification(
  userId: string, 
  notif: Omit<Notification, 'id' | 'userId' | 'isRead' | 'createdAt'> & { id?: string }
) {
  const notifications = getLocalNotifications(userId);
  const id = notif.id || `local-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  
  // Prevent duplicate insertion of notifications with predetermined IDs (e.g. deadline checks)
  if (notif.id && notifications.some(n => n.id === notif.id)) {
    return;
  }

  const newNotification: Notification = {
    ...notif,
    id,
    userId,
    isRead: false,
    createdAt: new Date().toISOString()
  } as unknown as Notification;

  notifications.unshift(newNotification);
  saveLocalNotifications(userId, notifications);
}

export function markLocalNotificationAsRead(userId: string, id: string) {
  const notifications = getLocalNotifications(userId);
  const updated = notifications.map(n => n.id === id ? { ...n, isRead: true } : n);
  saveLocalNotifications(userId, updated);
}

export function markAllLocalNotificationsAsRead(userId: string) {
  const notifications = getLocalNotifications(userId);
  const updated = notifications.map(n => ({ ...n, isRead: true }));
  saveLocalNotifications(userId, updated);
}

export function deleteLocalNotification(userId: string, id: string) {
  const notifications = getLocalNotifications(userId);
  const filtered = notifications.filter(n => n.id !== id);
  saveLocalNotifications(userId, filtered);
}

export function clearAllLocalNotifications(userId: string) {
  saveLocalNotifications(userId, []);
}

export function subscribeToLocalNotifications(callback: () => void) {
  window.addEventListener(NOTIF_EVENT, callback);
  return () => {
    window.removeEventListener(NOTIF_EVENT, callback);
  };
}
