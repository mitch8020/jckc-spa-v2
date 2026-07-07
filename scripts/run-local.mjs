#!/usr/bin/env node

import { randomBytes } from "node:crypto";
import {
  assertServiceDirs,
  ensureEnvFile,
  envPath,
  hasEnvValue,
  readEnvFile,
  runNpm,
  services,
  serviceKeysForTarget,
  spawnNpm,
  upsertEnv,
  writeEnvFile,
} from "./workspace-utils.mjs";

const defaults = {
  dev: {
    backendPort: 3001,
    frontendPort: 3000,
    host: "127.0.0.1",
  },
  prod: {
    backendPort: 3001,
    frontendPort: 3000,
    host: "127.0.0.1",
  },
};

function usage() {
  console.log(
    [
      "Usage: node scripts/run-local.mjs --env <dev|prod> --target <backend|frontend|both> [options]",
      "  --backend-port <port>   Default: 3001",
      "  --frontend-port <port>  Default: 3000",
      "  --host <host>           Default: 127.0.0.1",
      "  --dry-run               Print env updates and commands without writing or starting services",
    ].join("\n"),
  );
}

function parsePort(value, flag) {
  if (!/^\d+$/.test(value ?? "")) {
    throw new Error(`${flag} must be a numeric port`);
  }
  const port = Number(value);
  if (port < 1 || port > 65535) {
    throw new Error(`${flag} must be between 1 and 65535`);
  }
  return port;
}

function parseArgs(argv) {
  const opts = {
    env: null,
    target: "both",
    backendPort: null,
    frontendPort: null,
    host: null,
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--env") {
      opts.env = argv[i + 1] ?? null;
      i += 1;
    } else if (arg === "--target") {
      opts.target = argv[i + 1] ?? "both";
      i += 1;
    } else if (arg === "--backend-port") {
      opts.backendPort = parsePort(argv[i + 1], arg);
      i += 1;
    } else if (arg === "--frontend-port") {
      opts.frontendPort = parsePort(argv[i + 1], arg);
      i += 1;
    } else if (arg === "--host") {
      opts.host = argv[i + 1] ?? null;
      i += 1;
    } else if (arg === "--dry-run") {
      opts.dryRun = true;
    } else if (arg === "-h" || arg === "--help") {
      usage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!opts.env || !Object.hasOwn(defaults, opts.env)) {
    throw new Error("--env must be one of: dev, prod");
  }

  const profile = defaults[opts.env];
  return {
    ...opts,
    backendPort: opts.backendPort ?? profile.backendPort,
    frontendPort: opts.frontendPort ?? profile.frontendPort,
    host: opts.host ?? profile.host,
  };
}

function urlHost(host) {
  return host === "0.0.0.0" || host === "::" ? "localhost" : host;
}

function configureEnv(opts) {
  const backendUrl = `http://${urlHost(opts.host)}:${opts.backendPort}`;
  const frontendUrl = `http://${urlHost(opts.host)}:${opts.frontendPort}`;

  const backendEnvPath = ensureEnvFile("backend", opts.dryRun);
  const frontendEnvPath = ensureEnvFile("frontend", opts.dryRun);

  console.log(`[env] backend=${backendUrl} frontend=${frontendUrl}`);

  if (opts.dryRun) {
    console.log(`[dry-run] set PORT=${opts.backendPort} in ${backendEnvPath}`);
    console.log(`[dry-run] set BETTER_AUTH_URL=${backendUrl} in ${backendEnvPath}`);
    console.log(`[dry-run] set FRONTEND_ORIGIN=${frontendUrl} in ${backendEnvPath}`);
    console.log(`[dry-run] set VITE_API_URL=${backendUrl} in ${frontendEnvPath}`);
    return;
  }

  let backendEnv = readEnvFile(backendEnvPath);
  backendEnv = upsertEnv(backendEnv, "PORT", String(opts.backendPort));
  backendEnv = upsertEnv(backendEnv, "BETTER_AUTH_URL", backendUrl);
  backendEnv = upsertEnv(backendEnv, "FRONTEND_ORIGIN", frontendUrl);

  if (!hasEnvValue(backendEnv, "MONGO_URI")) {
    backendEnv = upsertEnv(backendEnv, "MONGO_URI", "mongodb://localhost:27017/jckc-v2");
    console.log(`[env] added default local MONGO_URI in ${backendEnvPath}`);
  }

  if (!hasEnvValue(backendEnv, "BETTER_AUTH_SECRET")) {
    backendEnv = upsertEnv(backendEnv, "BETTER_AUTH_SECRET", randomBytes(32).toString("hex"));
    console.log(`[env] generated local BETTER_AUTH_SECRET in ${backendEnvPath}`);
  }

  writeEnvFile(backendEnvPath, backendEnv);

  let frontendEnv = readEnvFile(frontendEnvPath);
  frontendEnv = upsertEnv(frontendEnv, "VITE_API_URL", backendUrl);
  writeEnvFile(frontendEnvPath, frontendEnv);
}

function stepsFor(serviceKey, opts) {
  if (serviceKey === "backend") {
    return opts.env === "prod"
      ? { pre: [["run", "build"]], start: ["run", "start:prod"] }
      : { pre: [], start: ["run", "start:dev"] };
  }

  const portArgs = ["--host", opts.host, "--strictPort", "--port", String(opts.frontendPort)];
  return opts.env === "prod"
    ? { pre: [["run", "build"]], start: ["run", "preview", "--", ...portArgs] }
    : { pre: [], start: ["run", "dev", "--", ...portArgs] };
}

async function runPreSteps(targets, opts) {
  for (const target of targets) {
    const service = services[target];
    const steps = stepsFor(target, opts);
    for (const step of steps.pre) {
      if (opts.dryRun) {
        console.log(`[dry-run] (${service.label}) npm ${step.join(" ")}`);
        continue;
      }

      console.log(`[local] ${service.label}: npm ${step.join(" ")}`);
      const result = await runNpm(step, service.dir);
      if (result.code !== 0) {
        throw new Error(`${service.label}: npm ${step.join(" ")} failed with exit ${result.code}`);
      }
    }
  }
}

function startServices(targets, opts) {
  if (opts.dryRun) {
    for (const target of targets) {
      const service = services[target];
      const step = stepsFor(target, opts).start;
      console.log(`[dry-run] (${service.label}) npm ${step.join(" ")}`);
    }
    return;
  }

  const children = targets.map((target) => {
    const service = services[target];
    const step = stepsFor(target, opts).start;
    console.log(`[local] ${service.label}: npm ${step.join(" ")}`);
    return {
      target,
      label: service.label,
      child: spawnNpm(step, service.dir),
    };
  });

  let stopping = false;

  const shutdown = (reason) => {
    if (stopping) {
      return;
    }
    stopping = true;
    if (reason) {
      console.error(reason);
    }
    for (const { child } of children) {
      if (!child.killed) {
        child.kill("SIGINT");
      }
    }
  };

  process.on("SIGINT", () => shutdown("\nReceived SIGINT. Stopping services..."));
  process.on("SIGTERM", () => shutdown("\nReceived SIGTERM. Stopping services..."));

  const exits = children.map(
    ({ label, child }) =>
      new Promise((resolve) => {
        child.on("close", (code, signal) => resolve({ label, code, signal }));
      }),
  );

  return Promise.race(exits).then((firstExit) => {
    if (!stopping) {
      shutdown(`${firstExit.label} exited. Stopping remaining services...`);
    }
    process.exit(firstExit.code ?? 0);
  });
}

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`[local] ${error.message}`);
    usage();
    process.exit(1);
  }

  assertServiceDirs();
  const targets = serviceKeysForTarget(opts.target);

  console.log(
    `[local] env=${opts.env} target=${opts.target} ports=${opts.backendPort}/${opts.frontendPort}`,
  );

  configureEnv(opts);
  await runPreSteps(targets, opts);
  await startServices(targets, opts);
}

main().catch((error) => {
  console.error(`[local] Fatal: ${error.message}`);
  process.exit(1);
});
