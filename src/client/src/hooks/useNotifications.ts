import { useState, useEffect, useRef } from 'react';
import type { ActivitySession, SessionSummary } from '@shared/types';
import { NOTIFICATION_COOLDOWN_MS } from '@shared/constants';

export interface UseNotificationsReturn {
  permission: NotificationPermission;
  requestPermission: () => Promise<NotificationPermission>;
  enabled: boolean;
}

type SessionSnapshot = {
  id: string;
  activityType?: string;
  parentID?: string;
  agent: string | null;
};

export function useNotifications(
  sessions: SessionSummary[],
  isReconnecting: boolean,
  activitySessions: ActivitySession[] = []
): UseNotificationsReturn {
  const [permission, setPermission] = useState<NotificationPermission>(() =>
    typeof Notification === 'undefined' ? 'denied' : Notification.permission
  );

  const prevSessionsRef = useRef<SessionSnapshot[] | null>(null);
  const cooldownRef = useRef<Map<string, number>>(new Map());
  const prevReconnectingRef = useRef<boolean>(isReconnecting);

  const requestPermission = async (): Promise<NotificationPermission> => {
    if (permission !== 'default') {
      return permission;
    }

    if (typeof Notification === 'undefined') {
      return 'denied';
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result;
    } catch {
      try {
        await new Promise<NotificationPermission>((resolve) => {
          Notification.requestPermission((result) => {
            resolve(result);
          });
        }).then((result) => {
          setPermission(result);
          return result;
        });
      } catch {
        return 'denied';
      }
      return 'denied';
    }
  };

  useEffect(() => {
    const notificationSessions: SessionSnapshot[] = [
      ...sessions.map(s => ({
        id: s.id,
        activityType: s.activityType,
        agent: s.agent || null,
      })),
      ...activitySessions.map(s => ({
        id: s.id,
        activityType: s.activityType,
        parentID: s.parentID,
        agent: s.agent || null,
      })),
    ];

    if (prevReconnectingRef.current === true && isReconnecting === false) {
      prevSessionsRef.current = notificationSessions;
      prevReconnectingRef.current = isReconnecting;
      return;
    }
    prevReconnectingRef.current = isReconnecting;

    if (prevSessionsRef.current === null) {
      prevSessionsRef.current = notificationSessions;
      return;
    }

    if (permission !== 'granted') {
      prevSessionsRef.current = notificationSessions;
      return;
    }

    const prevMap = new Map<string, SessionSnapshot>();
    for (const session of prevSessionsRef.current) {
      prevMap.set(session.id, session);
    }

    const currentMap = new Map<string, SessionSnapshot>();
    for (const session of notificationSessions) {
      currentMap.set(session.id, session);
    }

    const now = Date.now();

    for (const [sessionId, current] of currentMap.entries()) {
      const prev = prevMap.get(sessionId);

      if (!prev) continue;

      const lastNotification = cooldownRef.current.get(sessionId);
      if (lastNotification && now - lastNotification < NOTIFICATION_COOLDOWN_MS) continue;

      if (
        current.activityType === 'waiting-user' &&
        prev.activityType !== 'waiting-user'
      ) {
        new Notification('🔔 Input needed', {
          body: `${current.agent || 'Agent'} is waiting for your response`,
          tag: `ocwatch-waiting-${sessionId}`,
          requireInteraction: false,
        });
        cooldownRef.current.set(sessionId, now);
      }

    }

    prevSessionsRef.current = notificationSessions;
  }, [sessions, activitySessions, isReconnecting, permission]);

  return {
    permission,
    requestPermission,
    enabled: permission === 'granted',
  };
}
