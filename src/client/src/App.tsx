import { useState } from 'react'
import { LayoutDashboard, AlertCircle } from 'lucide-react'
import { ToolCalls } from './components/ToolCalls'
import { SessionList } from './components/SessionList'
import AgentTree from './components/AgentTree'
import { PlanProgress } from './components/PlanProgress'
import { AppProvider, useAppContext } from './store/AppContext'

function AppContent() {
  const { 
    sessions, 
    planProgress, 
    selectedSessionId, 
    setSelectedSessionId,
    loading,
    error 
  } = useAppContext();

  const [isToolCallsExpanded, setIsToolCallsExpanded] = useState(true)

  if (error) {
    return (
      <div className="flex h-screen bg-background text-text-primary items-center justify-center">
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-error" />
          <h2 className="text-xl font-semibold">Connection Error</h2>
          <p className="text-text-secondary">
            Failed to connect to OCWatch backend. Make sure the server is running on port 50234.
          </p>
          <p className="text-sm text-text-secondary font-mono bg-surface px-3 py-2 rounded border border-border">
            {error.message}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background text-text-primary overflow-hidden">
      <SessionList 
        sessions={sessions}
        selectedId={selectedSessionId}
        onSelect={setSelectedSessionId}
      />
      
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
            </div>
            {planProgress && (
              <div className="w-80">
                <PlanProgress plan={planProgress} />
              </div>
            )}
          </header>

          <main className="flex-1 p-6 min-h-0 overflow-hidden flex flex-col gap-6">
            {loading && sessions.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-text-secondary">
                Loading sessions...
              </div>
            ) : (
              <div className="flex-1 rounded-xl border border-border bg-surface shadow-sm overflow-hidden relative">
                <AgentTree
                  sessions={sessions}
                  selectedId={selectedSessionId}
                  onSelect={setSelectedSessionId}
                />
              </div>
            )}
          </main>
        </div>

        <ToolCalls 
            toolCalls={[]}
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
