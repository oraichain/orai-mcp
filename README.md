# Multichain MCP Server 🌐

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL%20v3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

> 🏗️ Built and maintained by [Oraichain Labs](https://github.com/oraichain)

A Model Context Protocol (MCP) server that provides onchain tools for AI applications like Claude Desktop and Cursor, allowing them to interact with multiple blockchain networks seamlessly.

## About Oraichain Labs

[Oraichain Labs](https://orai.io) is the team behind Oraichain, the world's first AI Layer 1 for Web3. We specialize in AI Agents and blockchain technologies:

- Autonomous Web3 AI Agents
- Decentralized AI Marketplace
- AI Oracle System
- Multichain DeFi protocols

## Contributors

Thanks goes to these wonderful people:

<a href="https://github.com/oraichain/multichain-mcp/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=oraichain/multichain-mcp" />
</a>

## Overview

This MCP server extends any MCP client's capabilities by providing tools to interact with multiple blockchain networks:

- Retrieve wallet addresses across different chains
- List wallet balances across networks
- Transfer funds between wallets
- Deploy smart contracts on any supported chain
- Interact with DeFi protocols across chains
- Call contract functions on any supported network
- Bridge assets between networks

The server is built using TypeScript and supports multiple blockchain networks through a unified interface.

## Prerequisites

- Node.js (v18 or higher)
- pnpm (v9.0.0 or higher)
- Wallet configuration for supported networks
- API keys for supported networks (optional)

### Installing Prerequisites

1. Install Node.js:

   - Visit [Node.js official website](https://nodejs.org/)
   - Download and install the LTS version (v18 or higher)
   - Verify installation:
     ```sh
     node --version
     npm --version
     ```

2. Install pnpm:

   ```sh
   # Using npm
   npm install -g pnpm

   # Verify installation
   pnpm --version
   ```

   For alternative installation methods, visit [pnpm installation guide](https://pnpm.io/installation).

## Installation

Clone this repository:

```sh
git clone https://github.com/oraichain/multichain-mcp.git
cd multichain-mcp
```

Install dependencies:

```sh
pnpm install
```

Build the project:

```sh
pnpm build
```

## Configuration

Create a `.env` file with your configuration:

```env
# Server Configuration
PORT=4000 # Optional, defaults to 4000

# Network RPC URLs
RPC_URL=your_rpc_url # Optional, defaults to https://rpc.orai.io
```

## Development

To develop all packages, run:

```sh
pnpm dev
```

To build all packages:

```sh
pnpm build
```

To run tests:

```sh
pnpm test
```

## Project Structure

This is a monorepo using Turborepo and pnpm workspaces. Here's the structure:

- `packages/`
  - `mcp-server/`: The core MCP server implementation
  - `agent-tools/`: Collection of blockchain interaction tools for AI agents
  - `agent-kit/`: Development kit for building AI agents with blockchain capabilities

Each package serves a specific purpose:

### MCP Server

The main server package that implements the Model Context Protocol for blockchain interactions. It provides the core functionality for handling requests from AI clients.

### Agent Tools

A collection of tools specifically designed for AI agents to interact with various blockchain networks. These tools are used by the MCP server to execute blockchain operations.

### Agent Kit

A development kit that helps developers build AI agents with blockchain capabilities. It includes utilities, types, and interfaces for consistent agent development.

## Integration with AI Tools

### Claude Desktop Integration

To add this MCP server to Claude Desktop:

1. Create or edit the Claude Desktop configuration file at:

   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
   - Linux: `~/.config/Claude/claude_desktop_config.json`

2. Add the following configuration:

```json
{
  "mcpServers": {
    "multichain-mcp": {
      "command": "node",
      "args": ["packages/mcp-server/dist/index.js"],
      "env": {
        "PORT": "4000",
        "RPC_URL": "your_rpc_url"
      },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

3. Restart Claude Desktop for the changes to take effect.

## 📜 License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

## 💬 Community

- [GitHub Discussions](https://github.com/oraichain/multichain-mcp/discussions)
- [Discord](https://discord.gg/oraichain)

## ⭐ Support

If you find Multichain MCP useful, please consider starring the repository and contributing new features or improvements!
