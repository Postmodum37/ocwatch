
import { LayoutDashboard, AlertCircle, WifiOff } from 'lucide-react'
import { DEFAULT_PORT } from '@shared/constants'
import { ActivityStream } from './components/ActivityStream'
import { SessionList } from './components/SessionList'
import { LiveActivity } from './components/LiveActivity'
import { PlanProgress } from './components/PlanProgress'
import { SessionStats } from './components/SessionStats'
import { AppProvider, useAppContext } from './store/AppContext'
import { SessionListSkeleton } from './components/LoadingSkeleton'
import { synthesizeActivityItems } from '@shared/types'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'

function AppContent() {
  const { 
    sessions, 
    planProgress,
    sessionStats, 
    activitySessions,
    selectedSessionId,  
    setSelectedSessionId,
    projects,
    selectedProjectId,
    setSelectedProjectId,
    loading,
    error,
    isReconnecting
  } = useAppContext();

  useKeyboardShortcuts({
    sessions,
    selectedId: selectedSessionId,
    onSelect: setSelectedSessionId,
  });

  const activityItems = synthesizeActivityItems(activitySessions)

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
              {planProgress && (
                <div className="w-64 hidden lg:block">
                  <PlanProgress plan={planProgress} />
                </div>
              )}
              <SessionStats stats={sessionStats} />
            </div>
          </header>

          <main className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <LiveActivity
              sessions={activitySessions}
              loading={loading}
            />
          </main>
        </div>

        <ActivityStream 
            items={activityItems}
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
