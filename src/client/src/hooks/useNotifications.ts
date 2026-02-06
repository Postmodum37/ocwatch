import { useState, useEffect, useRef } from 'react';
import type { SessionMetadata } from '@shared/types';

export interface UseNotificationsReturn {
  permission: NotificationPermission;
  requestPermission: () => Promise<NotificationPermission>;
  enabled: boolean;
}

type SessionSnapshot = {
  status?: string;
  activityType?: string;
  parentID?: string;
  agent: string | null;
};

export function useNotifications(
  sessions: SessionMetadata[],
  isReconnecting: boolean
): UseNotificationsReturn {
  const [permission, setPermission] = useState<NotificationPermission>(() =>
    typeof Notification === 'undefined' ? 'denied' : Notification.permission
  );

  const prevSessionsRef = useRef<SessionMetadata[] | null>(null);
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
    if (prevReconnectingRef.current === true && isReconnecting === false) {
      prevSessionsRef.current = sessions;
      prevReconnectingRef.current = isReconnecting;
      return;
    }
    prevReconnectingRef.current = isReconnecting;

    if (prevSessionsRef.current === null) {
      prevSessionsRef.current = sessions;
      return;
    }

    if (permission !== 'granted') {
      prevSessionsRef.current = sessions;
      return;
    }

    const prevMap = new Map<string, SessionSnapshot>();
    for (const session of prevSessionsRef.current) {
      prevMap.set(session.id, {
        status: session.status,
        activityType: session.activityType,
        parentID: session.parentID,
        agent: session.agent || null,
      });
    }

    const currentMap = new Map<string, SessionSnapshot>();
    for (const session of sessions) {
      currentMap.set(session.id, {
        status: session.status,
        activityType: session.activityType,
        parentID: session.parentID,
        agent: session.agent || null,
      });
    }

    const now = Date.now();

    for (const [sessionId, current] of currentMap.entries()) {
      const prev = prevMap.get(sessionId);

      if (!prev) continue;
      if (current.parentID) continue;

      const lastNotification = cooldownRef.current.get(sessionId);
      if (lastNotification && now - lastNotification < 10_000) continue;

      if (
        current.activityType === 'waiting-user' &&
        prev.activityType !== 'waiting-user' &&
        document.visibilityState !== 'visible'
      ) {
        new Notification('🔔 Input needed', {
          body: `${current.agent || 'Agent'} is waiting for your response`,
          tag: `ocwatch-waiting-${sessionId}`,
          requireInteraction: false,
        });
        cooldownRef.current.set(sessionId, now);
      }

      if (
        prev.status === 'working' &&
        current.status === 'completed' &&
        document.visibilityState !== 'visible'
      ) {
        new Notification('✅ Agent completed', {
          body: `${current.agent || 'Agent'} finished work`,
          tag: `ocwatch-completed-${sessionId}`,
          requireInteraction: false,
        });
        cooldownRef.current.set(sessionId, now);
      }
    }

    prevSessionsRef.current = sessions;
  }, [sessions, isReconnecting, permission]);

  return {
    permission,
    requestPermission,
    enabled: permission === 'granted',
  };
}
