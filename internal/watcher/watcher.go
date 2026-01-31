package watcher

import (
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
	"github.com/nxadm/tail"
	"github.com/tomas/ocwatch/internal/parser"
)

type Watcher struct {
	logDir    string
	entryChan chan *parser.LogEntry
	stopChan  chan struct{}
	wg        sync.WaitGroup
	mu        sync.Mutex
	tailer    *tail.Tail
}

func NewWatcher(logDir string) *Watcher {
	return &Watcher{
		logDir:    logDir,
		entryChan: make(chan *parser.LogEntry, 1000),
		stopChan:  make(chan struct{}),
	}
}

func (w *Watcher) Start() chan *parser.LogEntry {
	w.wg.Add(1)
	go w.watch()
	return w.entryChan
}

func (w *Watcher) Stop() {
	close(w.stopChan)
	w.wg.Wait()
	w.mu.Lock()
	if w.tailer != nil {
		w.tailer.Stop()
	}
	w.mu.Unlock()
	close(w.entryChan)
}

// watch handles the main watcher loop, using both fsnotify and a ticker
// to ensure we always tail the most recent log file even if fsnotify events are missed.
func (w *Watcher) watch() {
	defer w.wg.Done()

	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return
	}
	defer watcher.Close()

	if err := watcher.Add(w.logDir); err != nil {
		return
	}

	currentFile := ""
	// Periodic check as a fallback for fsnotify
	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-w.stopChan:
			return

		case <-ticker.C:
			// Fallback: check if a newer log file exists
			mostRecent := w.findMostRecentLogFile()
			if mostRecent != "" && mostRecent != currentFile {
				w.switchToFile(mostRecent)
				currentFile = mostRecent
			}

		case event, ok := <-watcher.Events:
			if !ok {
				return
			}

			// When a new log file is created, switch to it
			if event.Op&fsnotify.Create == fsnotify.Create {
				if strings.HasSuffix(event.Name, ".log") {
					// Small delay to ensure file is ready for reading
					time.Sleep(50 * time.Millisecond)
					mostRecent := w.findMostRecentLogFile()
					if mostRecent != "" && mostRecent != currentFile {
						w.switchToFile(mostRecent)
						currentFile = mostRecent
					}
				}
			}

		case err, ok := <-watcher.Errors:
			if !ok {
				return
			}
			_ = err
		}
	}
}

func (w *Watcher) findMostRecentLogFile() string {
	entries, err := os.ReadDir(w.logDir)
	if err != nil {
		return ""
	}

	var logFiles []string
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".log") {
			logFiles = append(logFiles, entry.Name())
		}
	}

	if len(logFiles) == 0 {
		return ""
	}

	sort.Strings(logFiles)
	return filepath.Join(w.logDir, logFiles[len(logFiles)-1])
}

func (w *Watcher) switchToFile(filePath string) {
	w.mu.Lock()
	oldTailer := w.tailer
	w.mu.Unlock()

	if oldTailer != nil {
		oldTailer.Stop()
	}

	config := tail.Config{
		Follow: true,
		ReOpen: false,
	}

	tailer, err := tail.TailFile(filePath, config)
	if err != nil {
		return
	}

	w.mu.Lock()
	w.tailer = tailer
	w.mu.Unlock()

	w.wg.Add(1)
	go w.tailLines(tailer)
}

func (w *Watcher) tailLines(tailer *tail.Tail) {
	defer w.wg.Done()

	for {
		select {
		case <-w.stopChan:
			return
		case line, ok := <-tailer.Lines:
			if !ok {
				return
			}

			if line == nil {
				continue
			}

			entry, err := parser.ParseLine(line.Text)
			if err != nil {
				continue
			}

			select {
			case w.entryChan <- entry:
			case <-w.stopChan:
				return
			}
		}
	}
}
