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
  console.error("Usage: node scripts/run-blt.mjs --target <backend|frontend|both> [--label <name>]");
}

function parseArgs(argv) {
  const opts = { target: "both", label: null };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--target") {
      opts.target = argv[i + 1] ?? "both";
      i += 1;
    } else if (arg === "--label") {
      opts.label = argv[i + 1] ?? null;
      i += 1;
    } else if (arg === "-h" || arg === "--help") {
      usage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return opts;
}

function sumMatches(line, regex) {
  let total = 0;
  for (const match of line.matchAll(regex)) {
    total += Number(match[1]);
  }
  return total;
}

function stripAnsi(text) {
  return text.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "");
}

function normalizeLines(output) {
  return output
    .split(/\r?\n/)
    .map((line) => stripAnsi(line).trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith(">"));
}

function parseNumericErrorWarningCounts(lines) {
  let errors = 0;
  let warnings = 0;

  for (const line of lines) {
    const lineErrors = sumMatches(line, /\b(\d+)\s+errors?\b/gi);
    const lineWarnings = sumMatches(line, /\b(\d+)\s+warnings?\b/gi);

    errors += lineErrors > 0 ? lineErrors : sumMatches(line, /\berrors?\s*[:=]\s*(\d+)\b/gi);
    warnings += lineWarnings > 0 ? lineWarnings : sumMatches(line, /\bwarnings?\s*[:=]\s*(\d+)\b/gi);
  }

  return { errors, warnings };
}

function analyzeBuildOutput(lines, exitCode) {
  let { errors, warnings } = parseNumericErrorWarningCounts(lines);
  if (exitCode !== 0 && errors === 0) {
    errors = 1;
  }
  return { errors, warnings };
}

function analyzeLintOutput(lines, exitCode) {
  let errors = 0;
  let warnings = 0;

  for (const line of lines) {
    const eslintMatch = line.match(/\((\d+)\s+errors?,\s*(\d+)\s+warnings?\)/i);
    if (eslintMatch) {
      errors += Number(eslintMatch[1]);
      warnings += Number(eslintMatch[2]);
    }
  }

  if (errors === 0 && warnings === 0) {
    const numeric = parseNumericErrorWarningCounts(lines);
    errors = numeric.errors;
    warnings = numeric.warnings;
  }

  if (exitCode !== 0 && errors === 0) {
    errors = 1;
  }

  return { errors, warnings };
}

function analyzeTestOutput(lines, exitCode) {
  let suiteFailures = 0;
  let testFailures = 0;
  let failSuiteMarkers = 0;
  let vitestFileFailures = 0;

  for (const line of lines) {
    if (/^Test Suites:/i.test(line)) {
      suiteFailures += sumMatches(line, /\b(\d+)\s+failed\b/gi);
    }

    if (/^Tests:/i.test(line)) {
      testFailures += sumMatches(line, /\b(\d+)\s+failed\b/gi);
    }

    if (/^Failed (Test Files|Suites|Tests)\b/i.test(line) || /^Test Files\b/i.test(line)) {
      vitestFileFailures += sumMatches(line, /\b(\d+)\s+failed\b/gi);
    }

    if (/^FAIL\b/i.test(line)) {
      failSuiteMarkers += 1;
    }
  }

  let errors = Math.max(suiteFailures, testFailures, vitestFileFailures, failSuiteMarkers);
  if (exitCode !== 0 && errors === 0) {
    errors = 1;
  }

  return { errors, warnings: 0 };
}

function analyzeOutput(output, phase, exitCode) {
  const lines = normalizeLines(output);

  switch (phase) {
    case "build":
      return analyzeBuildOutput(lines, exitCode);
    case "lint":
      return analyzeLintOutput(lines, exitCode);
    case "test":
      return analyzeTestOutput(lines, exitCode);
    default: {
      const numeric = parseNumericErrorWarningCounts(lines);
      if (exitCode !== 0 && numeric.errors === 0) {
        numeric.errors = 1;
      }
      return numeric;
    }
  }
}

function printReport(label, results) {
  const totalErrors = results.reduce((sum, result) => sum + result.errors, 0);
  const totalWarnings = results.reduce((sum, result) => sum + result.warnings, 0);
  const allPassed = results.every((result) => result.code === 0);

  console.log("\n[blt] Final Report");
  console.log(`[blt] Target: ${label}`);
  console.log("[blt] ---------------------------------------------------------");
  console.log("[blt] Service           Phase   Exit  Errors  Warnings");

  for (const result of results) {
    const service = result.service.padEnd(17, " ");
    const phase = result.phase.padEnd(7, " ");
    const exit = (result.code === 0 ? "PASS" : "FAIL").padEnd(5, " ");
    const errors = String(result.errors).padEnd(7, " ");
    const warnings = String(result.warnings).padEnd(8, " ");
    console.log(`[blt] ${service} ${phase} ${exit} ${errors} ${warnings}`);
  }

  console.log("[blt] ---------------------------------------------------------");
  console.log(`[blt] Total Errors: ${totalErrors}`);
  console.log(`[blt] Total Warnings: ${totalWarnings}`);
  console.log(`[blt] Overall: ${allPassed ? "PASS" : "FAIL"}`);
}

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`[blt] ${error.message}`);
    usage();
    process.exit(1);
  }

  assertServiceDirs();
  const targets = serviceKeysForTarget(opts.target);
  const label = opts.label ?? (opts.target === "both" ? "jckc-spa-v2" : services[opts.target].label);
  const results = [];

  console.log(`[blt] Starting ${label}`);

  for (const target of targets) {
    const service = services[target];
    for (const phase of phaseNames) {
      const command = phaseCommand(target, phase);
      console.log(`\n[blt] Running ${service.label} ${phase}: ${command.display}`);
      const execution = await runProcess(command, { capture: true });
      const counts = analyzeOutput(execution.output, phase, execution.code);
      results.push({
        service: service.label,
        phase,
        code: execution.code,
        errors: counts.errors,
        warnings: counts.warnings,
      });
    }
  }

  printReport(label, results);

  const failed = results.some((result) => result.code !== 0);
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.error(`[blt] Fatal: ${error.message}`);
  process.exit(1);
});
