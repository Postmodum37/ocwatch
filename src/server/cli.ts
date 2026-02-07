import { DEFAULT_PORT } from "../shared/constants";

export interface CLIFlags {
  port: number;
  noBrowser: boolean;
  projectPath: string | null;
  showHelp: boolean;
}

export function parseArgs(): CLIFlags {
  const args = process.argv.slice(2);
  const flags: CLIFlags = {
    port: DEFAULT_PORT,
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

export function printHelp(): void {
  console.log(`
OCWatch - Real-time OpenCode Activity Monitor

Usage: ocwatch [options]

Options:
  --port <number>      Server port (default: 50234)
  --no-browser         Skip auto-opening browser
  --project <path>     Set default project filter
  --help, -h           Show this help message

Examples:
  ocwatch
  ocwatch --port 50999
  ocwatch --no-browser
  ocwatch --project /path/to/project
`);
}

export async function openBrowser(url: string): Promise<void> {
  try {
    const isHeadless =
      process.env.CI === "true" ||
      (!process.env.DISPLAY && !process.env.WAYLAND_DISPLAY);

    if (isHeadless) {
      console.log(`📱 Open browser: ${url}`);
      return;
    }

    const proc = Bun.spawn(["open", url], {
      stdio: ["ignore", "ignore", "ignore"],
    });

    proc.exited.catch(() => {
    });
  } catch (error) {
    console.log(`📱 Open browser: ${url}`);
  }
}
