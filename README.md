# Multichain MCP Server 🟣

[![npm version](https://img.shields.io/npm/v/multichain-mcp.svg)](https://www.npmjs.com/package/multichain-mcp)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

A Model Context Protocol (MCP) server that provides onchain tools for AI applications like Claude Desktop and Cursor, allowing them to interact with multichain, from Oraichain to EVM, Solana, Near, and more!.

## Overview

This MCP server extends any MCP client's capabilities by providing tools to do anything on multichain:

- Retrieve wallet addresses
- List wallet balances
- Transfer funds between wallets
- Deploy smart contracts
- Call contract functions

The server interacts with multichain, powered by Oraichain Labs.

## Extending Multichain MCP with Tools

Multichain MCP is designed to be extensible, allowing you to add your own third-party protocols, tools, and data sources. This section provides an overview of how to extend the Multichain MCP server with new capabilities.

### Adding New Tools

If you want to add a new tool to the Multichain MCP server, follow these steps:

1. Create a new directory in the `src/tools` directory for your tool
2. Implement the tool following the existing patterns:
   - `index.ts`: Define and export your tools
   - `schemas.ts`: Define input schemas for your tools
   - `handlers.ts`: Implement the functionality of your tools
3. Add your tool to the list of available tools in `src/tools/index.ts`
4. Add documentation for your tool in the README.md
5. Add examples of how to use your tool in examples.md
6. Write tests for your tool

### Project Structure

The Multichain MCP server follows this structure for tools:

```
src/
├── tools/
│   ├── index.ts (exports toolsets)
│   ├── [TOOL_NAME]/ <-------------------------- ADD DIR HERE
│   │   ├── index.ts (defines and exports tools)
│   │   ├── schemas.ts (defines input schema)
│   │   └── handlers.ts (implements tool functionality)
│   └── utils/ (shared tool utilities)
```

### Best Practices for Tool Development

When developing new tools for Multichain MCP:

- Follow the existing code style and patterns
- Ensure your tool has a clear, focused purpose
- Provide comprehensive input validation
- Include detailed error handling
- Write thorough documentation
- Add examples demonstrating how to use your tool
- Include tests for your tool

For more detailed information on contributing to Multichain MCP, including adding new tools and protocols, see the [CONTRIBUTING.md](CONTRIBUTING.md) file.

## Prerequisites

- Node.js (v16 or higher)
- yarn

## Installation

### Option 1: Install from npm (Recommended)

```bash
# Install globally
npm install -g multichain-mcp

# Or install locally in your project
npm install multichain-mcp
```

### Option 2: Install from Source

1. Clone this repository:

   ```bash
   git clone https://github.com/oraichain/multichain-mcp.git
   cd multichain-mcp
   ```

2. Install dependencies:

   ```bash
   yarn
   ```

3. Build the project:

   ```bash
   yarn build
   ```

## Configuration

Create a `.env` file with your credentials:

## Testing

Test the MCP server to verify it's working correctly:

```bash
yarn test
```

This script will verify that your MCP server is working correctly by testing the connection and available tools.

## Examples

See the [examples.md](examples.md) file for detailed examples of how to interact with the Multchain MCP tools through Claude.

## Integration with Claude Desktop

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
         "args": ["/path/to/multichain-mcp/build/index.js"],
         "env": {},
         "disabled": false,
         "autoApprove": []
       }
     }
   }
   ```

3. Restart Claude Desktop for the changes to take effect.

## Available Tools

### get-address

## Security Considerations

- The configuration file contains sensitive information (API keys and seed phrases). Ensure it's properly secured and not shared.
- Consider using environment variables or a secure credential manager instead of hardcoding sensitive information.
- Be cautious when transferring funds or deploying contracts, as these operations are irreversible on the blockchain.
- When using the onramp functionality, ensure you're on a secure connection.
- Verify all transaction details before confirming, especially when transferring funds or buying credits.

## Troubleshooting

If you encounter issues:

4. Check the Claude Desktop logs for any error messages

## License

[GNU General Public License v3.0](LICENSE)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

For detailed guidelines on contributing to Multichain MCP, including:

- Reporting bugs
- Suggesting enhancements
- Development setup
- Coding standards
- **Adding new tools and protocols** (see also the [Extending Multichain MCP](#extending-multichain-mcp-with-tools) section above)
- Testing requirements
- Documentation standards

Please refer to our comprehensive [CONTRIBUTING.md](CONTRIBUTING.md) guide.

Basic contribution steps:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please make sure your code follows the existing style and includes appropriate tests.
