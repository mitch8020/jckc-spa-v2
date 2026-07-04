#!/usr/bin/env node

import {
  assertServiceDirs,
  phaseCommand,
  phaseNames,
  runProcess,
  serviceKeysForTarget,
  services,
} from "./workspace-utils.mjs";

function usage() {
  console.error("Usage: node scripts/run-command.mjs --phase <build|lint|test> --target <backend|frontend|both>");
}

function parseArgs(argv) {
  const opts = { phase: null, target: "both" };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--phase") {
      opts.phase = argv[i + 1] ?? null;
      i += 1;
    } else if (arg === "--target") {
      opts.target = argv[i + 1] ?? "both";
      i += 1;
    } else if (arg === "-h" || arg === "--help") {
      usage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!phaseNames.includes(opts.phase)) {
    throw new Error("--phase must be one of: build, lint, test");
  }

  return opts;
}

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`[run] ${error.message}`);
    usage();
    process.exit(1);
  }

  assertServiceDirs();
  const targets = serviceKeysForTarget(opts.target);
  const failures = [];

  for (const target of targets) {
    const service = services[target];
    const command = phaseCommand(target, opts.phase);
    console.log(`\n[${opts.phase}] ${service.label}: ${command.display}`);
    const result = await runProcess(command, { capture: true });
    if (result.code !== 0) {
      failures.push(`${service.label} exited ${result.code}`);
    }
  }

  if (failures.length > 0) {
    console.error(`\n[${opts.phase}] Failed: ${failures.join("; ")}`);
    process.exit(1);
  }

  console.log(`\n[${opts.phase}] Complete`);
}

main().catch((error) => {
  console.error(`[run] Fatal: ${error.message}`);
  process.exit(1);
});
