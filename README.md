# Bazel MCP Server

A local MCP server that exposes functionality of the [Bazel](https://bazel.build/) build system to MCP-enabled AI agents.

## Tools

The Bazel MCP Server provides the following tools:

- **build_target**: Build specified Bazel targets
- **query_target**: Query the dependency graph for targets matching a pattern
- **test_target**: Run tests for specified targets
- **list_targets**: List all available targets in the workspace (requires path parameter, use "//" for all targets)
- **fetch_dependencies**: Fetch external dependencies
- **set_workspace_path**: Change the Bazel workspace path at runtime

## Usage

### Installation

#### Using with Cursor

Add the following to `.cursor/mcp.json`.

You don't need to provide the workspace path, as the LLM can use `set_workspace_path` to change the workspace path at runtime.

The bazel binary usually gets picked up automatically, but if you run into issues, you can provide the path to the bazel binary using the `--bazel_path` flag.

```json
{
  "mcpServers": {
    "bazel": {
      "command": "npx",
      "args": [
        "github:nacgarg/bazel-mcp-server",
        "--bazel_path", # If you need to specify the bazel binary path
        "/absolute/path/to/your/bazel/binary",
        "--workspace_path", # If you need to specify the workspace path
        "/absolute/path/to/your/bazel/workspace"
        # See Configuration Table below for more options
      ]
    }
  }
}
```

#### Using with Claude Desktop

You can use the same configuration as above with Claude Desktop.

#### Launching standalone

```bash
# Run directly from GitHub (no installation needed)
npx -y github:nacgarg/bazel-mcp-server

# From npm (once published)
npx -y @nacgarg/bazel-mcp-server

# From source
git clone https://github.com/nacgarg/bazel-mcp-server.git
cd bazel-mcp-server
npm install
npm run build
```

### Configuration

This MCP server allows a couple different configuration methods. They will be used in the following order:

1. Command line arguments
2. Environment variables
3. Configuration file

### Configuration Table

| CLI Argument | Environment Variable | Configuration File Key | Description |
|--------------|----------------------|------------------------|-------------|
| `--bazel_path` | `MCP_BAZEL_PATH` | `bazel_path` | The path to the Bazel binary to use. |
| `--workspace_path` | `MCP_WORKSPACE_PATH` | `workspace_path` | The path to the Bazel workspace to use. |
| `--workspace_config` | `MCP_WORKSPACE_CONFIG` | `workspace_config` | The configuration of the workspace to use. By default, this uses the `.bazelrc` file in the workspace root. |
| `--log_path` | `MCP_LOG_PATH` | `log_path` | The path to write server logs to. |

## Debugging

Set the `DEBUG=true` environment variable to enable verbose logging to the console.

Setting the log path is also helpful for debugging with clients that don't print logs to the console (looking at you, Cursor).

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
