import { spawn } from "node:child_process";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
export const rootDir = path.resolve(scriptDir, "..");

export const services = {
  backend: {
    label: "jckc-spa-backend",
    dir: path.join(rootDir, "jckc-spa-backend"),
    envFile: ".env",
    envExample: ".env.example",
    phases: {
      build: { kind: "npm", args: ["run", "build"] },
      lint: {
        kind: "node",
        script: "node_modules/eslint/bin/eslint.js",
        args: ["{src,apps,libs,test}/**/*.ts"],
      },
      test: { kind: "node", script: "node_modules/jest/bin/jest.js", args: ["--runInBand"] },
    },
  },
  frontend: {
    label: "jckc-spa-frontend",
    dir: path.join(rootDir, "jckc-spa-frontend"),
    envFile: ".env.local",
    envExample: ".env.example",
    phases: {
      build: { kind: "npm", args: ["run", "build"] },
      lint: { kind: "npm", args: ["run", "lint"] },
      test: { kind: "npm", args: ["run", "test"] },
    },
  },
};

export const phaseNames = ["build", "lint", "test"];

export function serviceKeysForTarget(target) {
  if (target === "both") {
    return ["backend", "frontend"];
  }
  if (target === "backend" || target === "frontend") {
    return [target];
  }
  throw new Error("--target must be one of: backend, frontend, both");
}

export function assertServiceDirs() {
  for (const [key, service] of Object.entries(services)) {
    const packageJson = path.join(service.dir, "package.json");
    if (!existsSync(packageJson)) {
      throw new Error(`Missing ${key} package.json: ${packageJson}`);
    }
  }
}

export function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function quoteForCmd(value) {
  const text = String(value);
  if (/^[A-Za-z0-9_./:=@%+\-{},*]+$/.test(text)) {
    return text;
  }
  return `"${text.replace(/"/g, '\\"')}"`;
}

function windowsCommandConfig(command, args) {
  return {
    command: "cmd.exe",
    args: ["/d", "/s", "/c", [quoteForCmd(command), ...args.map(quoteForCmd)].join(" ")],
  };
}

function npmProcessConfig(args) {
  if (process.platform === "win32") {
    return windowsCommandConfig("npm", args);
  }
  return { command: "npm", args };
}

export function localBinPath(service, binName) {
  const filename = process.platform === "win32" ? `${binName}.cmd` : binName;
  const binPath = path.join(service.dir, "node_modules", ".bin", filename);
  if (!existsSync(binPath)) {
    throw new Error(`Missing local binary '${binName}' in ${service.dir}. Run npm run install.`);
  }
  return binPath;
}

export function resolveCommand(service, commandSpec) {
  if (commandSpec.kind === "npm") {
    const processConfig = npmProcessConfig(commandSpec.args);
    return {
      command: processConfig.command,
      args: processConfig.args,
      cwd: service.dir,
      display: `npm ${commandSpec.args.join(" ")}`,
    };
  }

  if (commandSpec.kind === "bin") {
    const binPath = localBinPath(service, commandSpec.bin);
    const processConfig =
      process.platform === "win32"
        ? windowsCommandConfig(binPath, commandSpec.args)
        : { command: binPath, args: commandSpec.args };

    return {
      command: processConfig.command,
      args: processConfig.args,
      cwd: service.dir,
      display: `${commandSpec.bin} ${commandSpec.args.join(" ")}`,
    };
  }

  if (commandSpec.kind === "node") {
    const scriptPath = path.join(service.dir, commandSpec.script);
    if (!existsSync(scriptPath)) {
      throw new Error(`Missing local Node CLI '${commandSpec.script}' in ${service.dir}. Run npm run install.`);
    }

    return {
      command: process.execPath,
      args: [scriptPath, ...commandSpec.args],
      cwd: service.dir,
      display: `node ${commandSpec.script}${commandSpec.args.length > 0 ? ` ${commandSpec.args.join(" ")}` : ""}`,
    };
  }

  throw new Error(`Unknown command kind: ${commandSpec.kind}`);
}

export function phaseCommand(serviceKey, phase) {
  const service = services[serviceKey];
  const commandSpec = service.phases[phase];
  if (!commandSpec) {
    throw new Error(`${serviceKey} does not define phase '${phase}'`);
  }
  return resolveCommand(service, commandSpec);
}

export function runProcess(commandConfig, { capture = false, env = process.env } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(commandConfig.command, commandConfig.args, {
      cwd: commandConfig.cwd,
      env,
      shell: false,
      stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    });

    let output = "";
    let exitCode = null;
    let stdoutEnded = !capture;
    let stderrEnded = !capture;

    const maybeResolve = () => {
      if (exitCode !== null && stdoutEnded && stderrEnded) {
        resolve({ code: exitCode, output });
      }
    };

    if (capture) {
      child.stdout.on("data", (chunk) => {
        const text = chunk.toString();
        output += text;
        process.stdout.write(text);
      });
      child.stdout.on("end", () => {
        stdoutEnded = true;
        maybeResolve();
      });

      child.stderr.on("data", (chunk) => {
        const text = chunk.toString();
        output += text;
        process.stdout.write(text);
      });
      child.stderr.on("end", () => {
        stderrEnded = true;
        maybeResolve();
      });
    }

    child.on("error", reject);
    child.on("close", (code) => {
      exitCode = code ?? 1;
      maybeResolve();
    });
  });
}

export function spawnNpm(args, cwd) {
  const processConfig = npmProcessConfig(args);
  return spawn(processConfig.command, processConfig.args, {
    cwd,
    stdio: "inherit",
    shell: false,
  });
}

export function runNpm(args, cwd) {
  const processConfig = npmProcessConfig(args);
  return runProcess({
    command: processConfig.command,
    args: processConfig.args,
    cwd,
    display: `npm ${args.join(" ")}`,
  });
}

export function envPath(serviceKey) {
  const service = services[serviceKey];
  return path.join(service.dir, service.envFile);
}

export function envExamplePath(serviceKey) {
  const service = services[serviceKey];
  return path.join(service.dir, service.envExample);
}

export function ensureEnvFile(serviceKey, dryRun) {
  const dest = envPath(serviceKey);
  if (existsSync(dest)) {
    return dest;
  }

  const source = envExamplePath(serviceKey);
  if (!existsSync(source)) {
    throw new Error(`Missing env example for ${serviceKey}: ${source}`);
  }

  if (dryRun) {
    console.log(`[dry-run] copy ${source} -> ${dest}`);
    return dest;
  }

  copyFileSync(source, dest);
  console.log(`[env] initialized ${dest} from ${source}`);
  return dest;
}

export function readEnvFile(filePath) {
  return existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
}

export function writeEnvFile(filePath, content) {
  writeFileSync(filePath, content, "utf8");
}

export function getEnvValue(content, key) {
  const matcher = new RegExp(`^\\s*${escapeRegExp(key)}\\s*=\\s*(.*)\\s*$`, "m");
  const match = content.match(matcher);
  if (!match) {
    return null;
  }

  return match[1].trim().replace(/^['"]|['"]$/g, "");
}

export function hasEnvValue(content, key) {
  const value = getEnvValue(content, key);
  return value != null && value.trim() !== "";
}

export function upsertEnv(content, key, value) {
  const normalized = content.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const matcher = new RegExp(`^\\s*${escapeRegExp(key)}\\s*=`);
  const nextLine = `${key}=${value}`;
  const index = lines.findIndex((line) => matcher.test(line));

  if (index >= 0) {
    lines[index] = nextLine;
  } else {
    lines.push(nextLine);
  }

  return `${lines.filter((line, i, arr) => !(i === arr.length - 1 && line === "")).join("\n")}\n`;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
