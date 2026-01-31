package watcher

// Watcher monitors file system changes for OpenCode activity
type Watcher struct {
}

// NewWatcher creates a new Watcher instance
func NewWatcher() *Watcher {
	return &Watcher{}
}
