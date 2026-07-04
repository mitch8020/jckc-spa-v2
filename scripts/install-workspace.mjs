#!/usr/bin/env node

import { assertServiceDirs, runNpm, services } from "./workspace-utils.mjs";

async function main() {
  assertServiceDirs();

  for (const key of ["backend", "frontend"]) {
    const service = services[key];
    console.log(`[install] ${key}: ${service.dir}`);
    const result = await runNpm(["install"], service.dir);
    if (result.code !== 0) {
      throw new Error(`${key}: npm install failed with exit ${result.code}`);
    }
  }
}

main().catch((error) => {
  console.error(`[install] Fatal: ${error.message}`);
  process.exit(1);
});
