# Bazel MCP Server

A local MCP server that exposes functionality of the [Bazel](https://bazel.build/) build system to MCP-enabled AI agents.

This is helpful when MCP environments either don't have an existing command-line tool, or where the invoked shell has a misconfigured environment that prevents Bazel from being used.

## Tools

The Bazel MCP Server provides the following tools:

- **bazel_build_target**: Build specified Bazel targets
- **bazel_query_target**: Query the dependency graph for targets matching a pattern
- **bazel_test_target**: Run tests for specified targets
- **bazel_list_targets**: List all available targets in the workspace (requires path parameter, use "//" for all targets)
- **bazel_fetch_dependencies**: Fetch external dependencies
- **bazel_set_workspace_path**: Change the Bazel workspace path at runtime

Each command (except `bazel_set_workspace_path`) supports an optional `additionalArgs` parameter that allows passing additional arguments to the underlying Bazel command. This is useful for specifying flags like `--verbose_failures` or `--test_output=all`.

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
        "-y",
        "github:nacgarg/bazel-mcp-server",

        // If you need to specify the bazel binary path
        "--bazel_path", 
        "/absolute/path/to/your/bazel/binary",

        // If you need to specify the workspace path
        "--workspace_path",
        "/absolute/path/to/your/bazel/workspace"

        // See Configuration Table below for more options
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

# From source
git clone https://github.com/nacgarg/bazel-mcp-server.git
cd bazel-mcp-server
npm install
npm run build
dist/index.js
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
