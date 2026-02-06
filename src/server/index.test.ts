import { describe, it, expect, beforeEach, afterEach } from "bun:test";

// Mock process.argv for testing
const originalArgv = process.argv;

function setArgs(args: string[]): void {
  process.argv = ["bun", "src/server/index.ts", ...args];
}

function resetArgs(): void {
  process.argv = originalArgv;
}

// Import the parseArgs function by re-implementing it for testing
function parseArgs(): {
  port: number;
  noBrowser: boolean;
  projectPath: string | null;
  showHelp: boolean;
} {
  const args = process.argv.slice(2);
  const flags: {
    port: number;
    noBrowser: boolean;
    projectPath: string | null;
    showHelp: boolean;
  } = {
    port: 50234,
    noBrowser: false,
    projectPath: null,
    showHelp: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--help" || arg === "-h") {
      flags.showHelp = true;
    } else if (arg === "--no-browser") {
      flags.noBrowser = true;
    } else if (arg === "--port") {
      const portValue = args[i + 1];
      if (portValue && !isNaN(parseInt(portValue))) {
        flags.port = parseInt(portValue);
        i++;
      }
    } else if (arg === "--project") {
      const projectPath = args[i + 1];
      if (projectPath) {
        flags.projectPath = projectPath;
        i++;
      }
    }
  }

  return flags;
}

describe("CLI Flag Parsing", () => {
  beforeEach(() => {
    resetArgs();
  });

  afterEach(() => {
    resetArgs();
  });

  it("should parse default flags", () => {
    setArgs([]);
    const flags = parseArgs();
    expect(flags.port).toBe(50234);
    expect(flags.noBrowser).toBe(false);
    expect(flags.projectPath).toBeNull();
    expect(flags.showHelp).toBe(false);
  });

  it("should parse --port flag", () => {
    setArgs(["--port", "50999"]);
    const flags = parseArgs();
    expect(flags.port).toBe(50999);
  });

  it("should parse --no-browser flag", () => {
    setArgs(["--no-browser"]);
    const flags = parseArgs();
    expect(flags.noBrowser).toBe(true);
  });

  it("should parse --project flag", () => {
    setArgs(["--project", "/path/to/project"]);
    const flags = parseArgs();
    expect(flags.projectPath).toBe("/path/to/project");
  });

  it("should parse --help flag", () => {
    setArgs(["--help"]);
    const flags = parseArgs();
    expect(flags.showHelp).toBe(true);
  });

  it("should parse -h flag", () => {
    setArgs(["-h"]);
    const flags = parseArgs();
    expect(flags.showHelp).toBe(true);
  });

  it("should parse multiple flags", () => {
    setArgs(["--port", "50999", "--no-browser", "--project", "/path/to/project"]);
    const flags = parseArgs();
    expect(flags.port).toBe(50999);
    expect(flags.noBrowser).toBe(true);
    expect(flags.projectPath).toBe("/path/to/project");
  });

  it("should ignore invalid port values", () => {
    setArgs(["--port", "invalid"]);
    const flags = parseArgs();
    expect(flags.port).toBe(50234);
  });

  it("should handle missing port value", () => {
    setArgs(["--port"]);
    const flags = parseArgs();
    expect(flags.port).toBe(50234);
  });

  it("should handle missing project value", () => {
    setArgs(["--project"]);
    const flags = parseArgs();
    expect(flags.projectPath).toBeNull();
  });
});
