#!/usr/bin/env node
/**
 * MCP server for Talocode Agent Wallet.
 * Stdio transport. The implementation lives in the npm package
 * so the CLI (`talocode-wallet mcp`) and this file stay the same server.
 * Tools can request payments. They cannot sign them.
 */
import { startMcp } from "../packages/agent-wallet/src/mcp.mjs";

startMcp();
