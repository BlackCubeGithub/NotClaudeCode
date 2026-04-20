#!/usr/bin/env node
import { startCLI } from './cli/index';

startCLI().catch((error: unknown) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
