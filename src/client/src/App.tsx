import { LayoutDashboard } from 'lucide-react'

function App() {
  return (
    <div className="min-h-screen bg-background text-text-primary p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="flex items-center gap-3 border-b border-border pb-6">
          <div className="p-2 bg-surface rounded-lg border border-border">
            <LayoutDashboard className="w-6 h-6 text-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">OCWatch</h1>
            <p className="text-text-secondary text-sm">OpenCode Activity Monitor</p>
          </div>
        </header>

        <main className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-xl border border-border bg-surface shadow-sm">
            <h2 className="text-lg font-medium mb-2">Setup Complete</h2>
            <p className="text-text-secondary">
              Tailwind CSS is configured with the dark theme.
            </p>
            <div className="mt-4 flex gap-2">
              <span className="inline-flex items-center px-2 py-1 rounded-md bg-success/10 text-success text-xs font-medium ring-1 ring-inset ring-success/20">
                Success
              </span>
              <span className="inline-flex items-center px-2 py-1 rounded-md bg-accent/10 text-accent text-xs font-medium ring-1 ring-inset ring-accent/20">
                Accent
              </span>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

export default App
