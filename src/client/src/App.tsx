import { useState } from 'react'
import { LayoutDashboard } from 'lucide-react'
import { ToolCalls } from './components/ToolCalls'
import { SessionList } from './components/SessionList'
import AgentTree from './components/AgentTree'
import type { ToolCall, SessionMetadata } from '@shared/types'

const mockSessions: SessionMetadata[] = [
  {
    id: '1',
    projectID: 'ocwatch',
    directory: '/Users/tomas/Workspace/ocwatch',
    title: 'Root: Implement Features',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '2',
    projectID: 'ocwatch',
    directory: '/Users/tomas/Workspace/ocwatch',
    title: 'Feat: Session Sidebar',
    parentID: '1',
    createdAt: new Date(Date.now() - 3600000),
    updatedAt: new Date(Date.now() - 1800000),
  },
  {
    id: '3',
    projectID: 'other-project',
    directory: '/Users/tomas/Workspace/other',
    title: 'Feat: Agent Tree',
    parentID: '1',
    createdAt: new Date(Date.now() - 86400000),
    updatedAt: new Date(Date.now() - 86400000),
  },
  {
    id: '4',
    projectID: 'other-project',
    directory: '/Users/tomas/Workspace/other',
    title: 'Fix: Styles',
    parentID: '3',
    createdAt: new Date(Date.now() - 90000000),
    updatedAt: new Date(Date.now() - 90000000),
  }
];

function App() {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>('1');
  const [isToolCallsExpanded, setIsToolCallsExpanded] = useState(true)
  const [toolCalls] = useState<ToolCall[]>([
    {
      id: '1',
      name: 'readFile',
      state: 'complete',
      timestamp: new Date(Date.now() - 1000 * 60 * 2),
      sessionID: 'sess-1',
      messageID: 'msg-1'
    },
    {
      id: '2',
      name: 'grep',
      state: 'pending',
      timestamp: new Date(Date.now() - 1000 * 30),
      sessionID: 'sess-1',
      messageID: 'msg-2'
    },
    {
      id: '3',
      name: 'exec',
      state: 'error',
      timestamp: new Date(Date.now() - 1000 * 5),
      sessionID: 'sess-1',
      messageID: 'msg-3'
    }
  ])

  return (
    <div className="flex h-screen bg-background text-text-primary overflow-hidden">
      <SessionList 
        sessions={mockSessions}
        selectedId={selectedSessionId}
        onSelect={setSelectedSessionId}
      />
      
      <div className="flex-1 flex flex-col min-w-0 relative h-full">
        <div className="flex-1 flex flex-col overflow-hidden">
          <header className="flex items-center gap-3 border-b border-border p-6 flex-shrink-0">
            <div className="p-2 bg-surface rounded-lg border border-border">
              <LayoutDashboard className="w-6 h-6 text-accent" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">OCWatch</h1>
              <p className="text-text-secondary text-sm">OpenCode Activity Monitor</p>
            </div>
          </header>

          <main className="flex-1 p-6 min-h-0 overflow-hidden flex flex-col gap-6">
            <div className="flex-1 rounded-xl border border-border bg-surface shadow-sm overflow-hidden relative">
              <AgentTree
                sessions={mockSessions}
                selectedId={selectedSessionId}
                onSelect={setSelectedSessionId}
              />
            </div>
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

export default App
