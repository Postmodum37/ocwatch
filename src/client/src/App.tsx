import { Suspense, useEffect } from 'react'
import { lazy } from 'react'
import { LayoutDashboard, AlertCircle, WifiOff, Bell, BellOff, Activity } from 'lucide-react'
import { DEFAULT_PORT } from '@shared/constants'
import { ActivityStream } from './components/ActivityStream'
import { SessionList } from './components/SessionList'
const GraphView = lazy(() => import('./components/graph/GraphView'))

import { SessionStats } from './components/SessionStats'
import { AppProvider, useAppContext } from './store/AppContext'
import { SessionListSkeleton, LoadingSkeleton } from './components/LoadingSkeleton'
import { synthesizeActivityItems } from '@shared/types'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useMemo } from 'react'
import { EmptyState } from './components/EmptyState'
function AppContent() {
  const { 
    sessions, 
    sessionStats, 
    activitySessions,
    selectedSessionId,  
    setSelectedSessionId,
    projects,
    selectedProjectId,
    setSelectedProjectId,
    loading,
    error,
    isReconnecting,
    notificationPermission,
    requestNotificationPermission,
  } = useAppContext();

  useKeyboardShortcuts({
    sessions,
    selectedId: selectedSessionId,
    onSelect: setSelectedSessionId,
  });

  // Prefetch GraphView chunk on mount
  useEffect(() => {
    import('./components/graph/GraphView');
  }, []);

  const activityEntries = useMemo(
    () => synthesizeActivityItems(activitySessions).filter(item => item.type !== 'tool-call'),
    [activitySessions]
  )

  if (error && !isReconnecting) {
    return (
      <div className="flex h-screen bg-background text-text-primary items-center justify-center">
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-error" />
          <h2 className="text-xl font-semibold">Connection Lost</h2>
           <p className="text-text-secondary">
             Failed to connect to OCWatch backend. Make sure the server is running on port {DEFAULT_PORT}.
           </p>
          <p className="text-sm text-text-secondary font-mono bg-surface px-3 py-2 rounded border border-border">
            {error.message}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background text-text-primary overflow-hidden">
      {loading && sessions.length === 0 ? (
        <SessionListSkeleton />
      ) : (
        <SessionList 
          sessions={sessions}
          selectedId={selectedSessionId}
          onSelect={setSelectedSessionId}
          projects={projects}
          selectedProjectId={selectedProjectId}
          onProjectSelect={setSelectedProjectId}
        />
      )}
      
      <div className="flex-1 flex flex-col min-w-0 relative h-full">
        <div className="flex-1 flex flex-col overflow-hidden">
          <header className="flex items-center justify-between gap-4 border-b border-border p-4 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-surface rounded-lg border border-border">
                <LayoutDashboard className="w-5 h-5 text-accent" />
              </div>
              <div className="flex items-baseline gap-2">
                <h1 className="text-lg font-semibold tracking-tight">OCWatch</h1>
                <span className="text-text-secondary text-xs hidden sm:inline-block">Activity Monitor</span>
              </div>
              {isReconnecting && (
                <div className="flex items-center gap-2 px-2 py-1 bg-warning/10 border border-warning/20 rounded-lg">
                  <WifiOff className="w-3 h-3 text-warning animate-pulse" />
                  <span className="text-xs text-warning">Reconnecting...</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-4">
              <SessionStats stats={sessionStats} />
              {notificationPermission === 'default' ? (
                <button
                  type="button"
                  onClick={() => requestNotificationPermission()}
                  className="p-1.5 rounded-lg border border-border hover:bg-surface transition-colors"
                  title="Enable notifications"
                >
                  <Bell className="w-4 h-4 text-text-secondary" />
                </button>
              ) : notificationPermission === 'granted' ? (
                <span
                  className="p-1.5 rounded-lg border border-border bg-surface"
                  title="Notifications enabled"
                >
                  <Bell className="w-4 h-4 text-accent" />
                </span>
              ) : (
                <span
                  className="p-1.5 rounded-lg border border-border opacity-50"
                  title="Notifications blocked — enable in browser settings"
                >
                  <BellOff className="w-4 h-4 text-text-secondary" />
                </span>
              )}
            </div>
          </header>

           <main className="flex-1 min-h-0 overflow-hidden flex flex-col">
             {activitySessions.length === 0 ? (
               <EmptyState
                 icon={Activity}
                 title="No Activity"
                 description="Select a session to view live activity"
               />
             ) : (
               <Suspense fallback={<LoadingSkeleton />}>
                 <GraphView
                   sessions={activitySessions}
                   loading={loading}
                 />
               </Suspense>
             )}
           </main>
        </div>

        <ActivityStream 
            entries={activityEntries}
        />
      </div>
    </div>
  )
}

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App
