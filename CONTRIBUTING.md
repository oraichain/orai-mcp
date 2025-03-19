# Contributing to Multichain MCP

We love your input! We want to make contributing to Multichain MCP as easy and transparent as possible, whether it's:

- Reporting a bug
- Discussing the current state of the code
- Submitting a fix
- Proposing new features
- Becoming a maintainer

## We Develop with GitHub

We use GitHub to host code, to track issues and feature requests, as well as accept pull requests.

## We Use [GitHub Flow](https://guides.github.com/introduction/flow/index.html)

Pull requests are the best way to propose changes to the codebase. We actively welcome your pull requests:

1. Fork the repo and create your branch from `main`.
2. If you've added code that should be tested, add tests.
3. If you've changed APIs, update the documentation.
4. Ensure the test suite passes.
5. Make sure your code lints.
6. Issue that pull request!

## Development Process

1. Clone the repository:

```sh
git clone https://github.com/oraichain/multichain-mcp.git
```

2. Install dependencies:

```sh
pnpm install
```

3. Create a branch for your feature:

```sh
git checkout -b feature/amazing-feature
```

4. Make your changes and commit them:

```sh
git commit -m 'Add some amazing feature'
```

5. Push to your fork:

```sh
git push origin feature/amazing-feature
```

6. Open a Pull Request

## Development Setup

1. Ensure you have Node.js v18+ and pnpm v9+ installed
2. Install dependencies: `pnpm install`
3. Build the project: `pnpm build`
4. Run tests: `pnpm test`

### Package Development

When working on specific packages:

- `mcp-server`: Core MCP server implementation

  ```sh
  cd packages/mcp-server
  pnpm dev
  ```

- `agent-tools`: Blockchain interaction tools

  ```sh
  cd packages/agent-tools
  pnpm dev
  ```

- `agent-kit`: Development kit
  ```sh
  cd packages/agent-kit
  pnpm dev
  ```

## Adding Support for New Chains

To add support for a new blockchain:

1. Add the chain configuration in `packages/agent-tools`:

   - Create a new chain adapter in `src/chains/`
   - Implement the required interfaces
   - Add chain-specific utilities

2. Update the MCP server in `packages/mcp-server`:

   - Add new chain handlers
   - Implement chain-specific endpoints
   - Update configuration schema

3. Add development utilities in `packages/agent-kit`:

   - Add chain-specific types
   - Update documentation
   - Add example implementations

4. Add tests for all new functionality
5. Update the main README with the new chain's information

## Any contributions you make will be under the GNU General Public License v3.0

In short, when you submit code changes, your submissions are understood to be under the same [GNU General Public License v3.0](https://www.gnu.org/licenses/gpl-3.0) that covers the project. Feel free to contact the maintainers if that's a concern.

## Report bugs using GitHub's [issue tracker](https://github.com/oraichain/multichain-mcp/issues)

We use GitHub issues to track public bugs. Report a bug by [opening a new issue](https://github.com/oraichain/multichain-mcp/issues/new); it's that easy!

## Write bug reports with detail, background, and sample code

**Great Bug Reports** tend to have:

- A quick summary and/or background
- Steps to reproduce
  - Be specific!
  - Give sample code if you can.
- What you expected would happen
- What actually happens
- Notes (possibly including why you think this might be happening, or stuff you tried that didn't work)

## License

By contributing, you agree that your contributions will be licensed under the GNU General Public License v3.0.
