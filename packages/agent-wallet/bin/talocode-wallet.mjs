#!/usr/bin/env node
import { run } from "../src/cli.mjs";

const code = await run(process.argv.slice(2));
if (code !== 0) process.exit(code);
