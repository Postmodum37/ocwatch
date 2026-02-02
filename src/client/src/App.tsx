import { useState } from 'react'
import { LayoutDashboard, AlertCircle, WifiOff } from 'lucide-react'
import { ToolCalls } from './components/ToolCalls'
import { SessionList } from './components/SessionList'
import { LiveActivity } from './components/LiveActivity'
import { PlanProgress } from './components/PlanProgress'
import { AppProvider, useAppContext } from './store/AppContext'
import { SessionListSkeleton } from './components/LoadingSkeleton'
import type { ToolCall } from '@shared/types'

function AppContent() {
  const { 
    sessions, 
    planProgress, 
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

  const [isToolCallsExpanded, setIsToolCallsExpanded] = useState(true)

  // Collect all tool calls from activitySessions
  const toolCalls: ToolCall[] = activitySessions.flatMap((session) =>
    (session.toolCalls || []).map((toolCallSummary) => ({
      id: toolCallSummary.id,
      name: toolCallSummary.name,
      state: toolCallSummary.state,
      timestamp: new Date(toolCallSummary.timestamp),
      sessionID: session.id,
      messageID: toolCallSummary.id, // Use tool call ID as messageID proxy
    }))
  )

  if (error && !isReconnecting) {
    return (
      <div className="flex h-screen bg-background text-text-primary items-center justify-center">
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-error" />
          <h2 className="text-xl font-semibold">Connection Lost</h2>
          <p className="text-text-secondary">
            Failed to connect to OCWatch backend. Make sure the server is running on port 50234.
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
          <header className="flex items-center justify-between gap-6 border-b border-border p-6 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-surface rounded-lg border border-border">
                <LayoutDashboard className="w-6 h-6 text-accent" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">OCWatch</h1>
                <p className="text-text-secondary text-sm">OpenCode Activity Monitor</p>
              </div>
              {isReconnecting && (
                <div className="flex items-center gap-2 px-3 py-1 bg-warning/10 border border-warning/20 rounded-lg">
                  <WifiOff className="w-4 h-4 text-warning animate-pulse" />
                  <span className="text-sm text-warning">Reconnecting...</span>
                </div>
              )}
            </div>
            {planProgress && (
              <div className="w-80">
                <PlanProgress plan={planProgress} />
              </div>
            )}
          </header>

          <main className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <LiveActivity
              sessions={activitySessions}
              loading={loading}
            />
          </main>
        </div>

        <ToolCalls 
            toolCalls={toolCalls}
            isExpanded={isToolCallsExpanded}
            onToggle={() => setIsToolCallsExpanded(!isToolCallsExpanded)}
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
