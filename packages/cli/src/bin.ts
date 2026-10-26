#!/usr/bin/env node
/**
 * @license Apache-2.0
 * ShellMind CLI Binary Entrypoint
 */

import { createCLI } from './cli.js';

const cli = createCLI();
cli.parse(process.argv);
