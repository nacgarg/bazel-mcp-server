#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequest,
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";

// Logger configuration
let logPath = '';

/**
 * Centralized logging function that handles both console and file logging
 */
function log(message: string, level: 'info' | 'error' = 'info', toConsole = true): void {
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp}: ${message}`;
  
  // Log to file if path is configured
  if (logPath) {
    fs.appendFileSync(logPath, `${logMessage}\n`);
  }
  
  // Log to console if requested
  if (toConsole) {
    if (level === 'error') {
      console.error(logMessage);
    } else if (process.env.DEBUG) {
      console.error(logMessage); // Debug logs also go to stderr
    }
  }
}

// Type definitions for tool arguments
interface BuildTargetArgs {
  targets: string[];
}

interface QueryTargetArgs {
  pattern: string;
}

interface TestTargetArgs {
  targets: string[];
}

interface ListTargetsArgs {
  path: string;
}

interface FetchDependenciesArgs {
  targets?: string[];
}

interface SetWorkspacePathArgs {
  path: string;
}

// Tool definitions
const buildTargetTool: Tool = {
  name: "bazel_build_target",
  description: "Build specified Bazel targets",
  inputSchema: {
    type: "object",
    properties: {
      targets: {
        type: "array",
        items: {
          type: "string",
        },
        description: "List of Bazel targets to build (e.g. ['//path/to:target'])",
      },
    },
    required: ["targets"],
  },
};

const queryTargetTool: Tool = {
  name: "bazel_query_target",
  description: "Query the Bazel dependency graph for targets matching a pattern",
  inputSchema: {
    type: "object",
    properties: {
      pattern: {
        type: "string",
        description: "Bazel query pattern (e.g. 'deps(//path/to:target)')",
      },
    },
    required: ["pattern"],
  },
};

const testTargetTool: Tool = {
  name: "bazel_test_target",
  description: "Run Bazel tests for specified targets",
  inputSchema: {
    type: "object",
    properties: {
      targets: {
        type: "array",
        items: {
          type: "string",
        },
        description: "List of Bazel test targets to run (e.g. ['//path/to:test'])",
      },
    },
    required: ["targets"],
  },
};

const listTargetsTool: Tool = {
  name: "bazel_list_targets",
  description: "List all available Bazel targets under a given path",
  inputSchema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Path within the workspace to list targets for (e.g. '//path/to' or '//' for all targets)",
      },
    },
    required: ["path"],
  },
};

const fetchDependenciesTool: Tool = {
  name: "bazel_fetch_dependencies",
  description: "Fetch Bazel external dependencies",
  inputSchema: {
    type: "object",
    properties: {
      targets: {
        type: "array",
        items: {
          type: "string",
        },
        description: "List of specific targets to fetch dependencies for",
      },
    },
  },
};

const setWorkspacePathTool: Tool = {
  name: "bazel_set_workspace_path",
  description: "Set the current Bazel workspace path for subsequent commands",
  inputSchema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "The absolute path to the Bazel workspace directory",
      },
    },
    required: ["path"],
  },
};

class BazelClient {
  private bazelPath: string;
  private workspacePath: string;
  private workspaceConfig: string | undefined;

  constructor(
    bazelPath: string,
    workspacePath: string,
    workspaceConfig?: string
  ) {
    this.bazelPath = bazelPath;
    this.workspacePath = workspacePath;
    this.workspaceConfig = workspaceConfig;
  }

  private runBazelCommand(
    command: string,
    args: string[] = [],
    onOutput?: (chunk: string) => void
  ): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const fullArgs = [command, ...args];
      
      if (this.workspaceConfig) {
        fullArgs.unshift(`--bazelrc=${this.workspaceConfig}`);
      }

      const cmdString = `${this.bazelPath} ${fullArgs.join(" ")}`;
      log(`Running command: ${cmdString} in directory: ${this.workspacePath}`);
      
      const process = spawn(this.bazelPath, fullArgs, {
        cwd: this.workspacePath,
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      process.stdout.on("data", (data) => {
        const chunk = data.toString();
        stdout += chunk;
        log(`STDOUT: ${chunk}`, 'info', false);
        if (onOutput) {
          onOutput(chunk);
        }
      });

      process.stderr.on("data", (data) => {
        const chunk = data.toString();
        stderr += chunk;
        log(`STDERR: ${chunk}`, 'info', false);
        if (onOutput) {
          onOutput(chunk);
        }
      });

      process.on("close", (code) => {
        log(`Command completed with exit code: ${code}`);
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          const errorMsg = `Bazel command failed with code ${code}: ${stderr}`;
          log(errorMsg, 'error');
          reject(new Error(errorMsg));
        }
      });

      process.on("error", (err) => {
        log(`Command execution error: ${err.message}`, 'error');
        reject(err);
      });
    });
  }

  async buildTargets(targets: string[], onOutput?: (chunk: string) => void): Promise<string> {
    const { stdout, stderr } = await this.runBazelCommand("build", targets, onOutput);
    return `${stdout}\n${stderr}`;
  }

  async queryTarget(pattern: string, onOutput?: (chunk: string) => void): Promise<string> {
    const { stdout, stderr } = await this.runBazelCommand("query", [pattern], onOutput);
    return stdout || stderr;
  }

  async testTargets(targets: string[], onOutput?: (chunk: string) => void): Promise<string> {
    const { stdout, stderr } = await this.runBazelCommand("test", targets, onOutput);
    return `${stdout}\n${stderr}`;
  }

  async listTargets(path: string, onOutput?: (chunk: string) => void): Promise<string> {
    const queryPattern = `${path}/...`;
    const { stdout } = await this.runBazelCommand("query", [queryPattern], onOutput);
    return stdout;
  }

  async fetchDependencies(targets?: string[], onOutput?: (chunk: string) => void): Promise<string> {
    const args = ["fetch"];
    if (targets && targets.length > 0) {
      args.push(...targets);
    } else {
      args.push("//...");
    }
    
    const { stdout, stderr } = await this.runBazelCommand("build", args, onOutput);
    return `${stdout}\n${stderr}`;
  }
  
  setWorkspacePath(newPath: string): string {
    if (!fs.existsSync(newPath)) {
      throw new Error(`Workspace path does not exist: ${newPath}`);
    }
    
    // Check if it appears to be a Bazel workspace
    const isWorkspace = fs.existsSync(path.join(newPath, 'WORKSPACE')) || 
                        fs.existsSync(path.join(newPath, 'WORKSPACE.bazel')) ||
                        fs.existsSync(path.join(newPath, 'MODULE.bazel'));
                        
    if (!isWorkspace) {
      throw new Error(`Path does not appear to be a Bazel workspace: ${newPath}`);
    }
    
    const oldPath = this.workspacePath;
    this.workspacePath = newPath;
    return `Workspace path updated from ${oldPath} to ${newPath}`;
  }
}

// Parse CLI arguments and environment variables
function getConfig() {
  const args = process.argv.slice(2);
  const config: {
    bazelPath: string;
    workspacePath: string;
    workspaceConfig?: string;
    logPath: string;
  } = {
    bazelPath: "bazel",
    workspacePath: process.cwd(),
    logPath: ""
  };

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === "--bazel_path" && i + 1 < args.length) {
      config.bazelPath = args[++i];
    } else if (arg === "--workspace_path" && i + 1 < args.length) {
      config.workspacePath = args[++i];
    } else if (arg === "--workspace_config" && i + 1 < args.length) {
      config.workspaceConfig = args[++i];
    } else if (arg === "--log_path" && i + 1 < args.length) {
      config.logPath = args[++i];
    }
  }

  // Override with environment variables if set
  if (process.env.MCP_BAZEL_PATH) {
    config.bazelPath = process.env.MCP_BAZEL_PATH;
  }
  
  if (process.env.MCP_WORKSPACE_PATH) {
    config.workspacePath = process.env.MCP_WORKSPACE_PATH;
  }
  
  if (process.env.MCP_WORKSPACE_CONFIG) {
    config.workspaceConfig = process.env.MCP_WORKSPACE_CONFIG;
  }
  
  if (process.env.MCP_LOG_PATH) {
    config.logPath = process.env.MCP_LOG_PATH;
  }

  // Check for config file
  const configFilePath = path.resolve(process.cwd(), ".bazel-mcp-config.json");
  if (fs.existsSync(configFilePath)) {
    try {
      const fileConfig = JSON.parse(fs.readFileSync(configFilePath, "utf-8"));
      
      if (!process.env.MCP_BAZEL_PATH && !args.includes("--bazel_path") && fileConfig.bazel_path) {
        config.bazelPath = fileConfig.bazel_path;
      }
      
      if (!process.env.MCP_WORKSPACE_PATH && !args.includes("--workspace_path") && fileConfig.workspace_path) {
        config.workspacePath = fileConfig.workspace_path;
      }
      
      if (!process.env.MCP_WORKSPACE_CONFIG && !args.includes("--workspace_config") && fileConfig.workspace_config) {
        config.workspaceConfig = fileConfig.workspace_config;
      }
      
      if (!process.env.MCP_LOG_PATH && !args.includes("--log_path") && fileConfig.log_path) {
        config.logPath = fileConfig.log_path;
      }
    } catch (error) {
      console.error("Error reading config file:", error);
    }
  }

  // Update the global log path
  logPath = config.logPath;

  return config;
}

async function main() {
  const config = getConfig();
  
  // Server startup
  log(`Server starting. PWD: ${process.cwd()}`);
  if (logPath) {
    log(`Log path configured: ${logPath}`);
  }
  
  log("Starting Bazel MCP Server...", 'info', true);
  log(`Using Bazel at: ${config.bazelPath}`);
  log(`Workspace path: ${config.workspacePath}`);
  
  if (config.workspaceConfig) {
    log(`Workspace config: ${config.workspaceConfig}`);
  }
  
  // Debug info (only logged to file)
  log(`Environment variables: ${JSON.stringify(process.env)}`, 'info', false);
  log(`Command line arguments: ${JSON.stringify(process.argv)}`, 'info', false);
  
  try {
    // Check if we're in a Bazel workspace
    const workspaceExists = fs.existsSync(path.join(config.workspacePath, 'WORKSPACE')) || 
                           fs.existsSync(path.join(config.workspacePath, 'WORKSPACE.bazel')) ||
                           fs.existsSync(path.join(config.workspacePath, 'MODULE.bazel'));
    log(`Is Bazel workspace: ${workspaceExists}`);
    
    if (!workspaceExists) {
      log(`Warning: ${config.workspacePath} does not appear to be a Bazel workspace`, 'error');
    }
  } catch (err) {
    log(`Error checking workspace: ${err}`, 'error');
  }

  const server = new Server(
    {
      name: "Bazel MCP Server",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  const bazelClient = new BazelClient(
    config.bazelPath,
    config.workspacePath,
    config.workspaceConfig
  );

  server.setRequestHandler(
    CallToolRequestSchema,
    async (request: CallToolRequest) => {
      log(`Received CallToolRequest for tool: ${request.params.name}`, 'info', process.env.DEBUG === 'true');
      
      try {
        if (!request.params.arguments) {
          throw new Error("No arguments provided");
        }

        let response;
        switch (request.params.name) {
          case "build_target": {
            const args = request.params.arguments as unknown as BuildTargetArgs;
            log(`Processing build_target with args: ${JSON.stringify(args)}`, 'info', false);
            if (!args.targets || args.targets.length === 0) {
              throw new Error("Missing required argument: targets");
            }
            response = await bazelClient.buildTargets(args.targets);
            break;
          }

          case "query_target": {
            const args = request.params.arguments as unknown as QueryTargetArgs;
            log(`Processing query_target with pattern: ${args.pattern}`, 'info', false);
            if (!args.pattern) {
              throw new Error("Missing required argument: pattern");
            }
            response = await bazelClient.queryTarget(args.pattern);
            break;
          }

          case "test_target": {
            const args = request.params.arguments as unknown as TestTargetArgs;
            log(`Processing test_target with args: ${JSON.stringify(args)}`, 'info', false);
            if (!args.targets || args.targets.length === 0) {
              throw new Error("Missing required argument: targets");
            }
            response = await bazelClient.testTargets(args.targets);
            break;
          }

          case "list_targets": {
            const args = request.params.arguments as unknown as ListTargetsArgs;
            log(`Processing list_targets for path: ${args.path}`, 'info', false);
            if (!args.path) {
              throw new Error("Missing required argument: path");
            }
            response = await bazelClient.listTargets(args.path);
            break;
          }

          case "fetch_dependencies": {
            const args = request.params.arguments as unknown as FetchDependenciesArgs;
            log(`Processing fetch_dependencies`, 'info', false);
            response = await bazelClient.fetchDependencies(args.targets);
            break;
          }
          
          case "set_workspace_path": {
            const args = request.params.arguments as unknown as SetWorkspacePathArgs;
            log(`Processing set_workspace_path to: ${args.path}`, 'info', false);
            if (!args.path) {
              throw new Error("Missing required argument: path");
            }
            response = bazelClient.setWorkspacePath(args.path);
            break;
          }

          default:
            throw new Error(`Unknown tool: ${request.params.name}`);
        }

        const result = {
          content: [{ type: "text", text: response }],
        };
        log(`Tool execution completed successfully`, 'info', false);
        return result;
      } catch (error) {
        log(`Error executing tool: ${error instanceof Error ? error.message : String(error)}`, 'error');
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: error instanceof Error ? error.message : String(error),
              }),
            },
          ],
        };
      }
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    log("Received ListToolsRequest", 'info', process.env.DEBUG === 'true');
    
    const response = {
      tools: [
        buildTargetTool,
        queryTargetTool,
        testTargetTool,
        listTargetsTool,
        fetchDependenciesTool,
        setWorkspacePathTool,
      ],
    };
    
    log(`Sending ListToolsResponse with ${response.tools.length} tools`, 'info', false);
    return response;
  });

  const transport = new StdioServerTransport();
  log("Connecting server to transport...", 'info', true);
  await server.connect(transport);

  log("Bazel MCP Server running on stdio", 'info', true);
}

main().catch((error) => {
  log(`FATAL ERROR: ${error.message}`, 'error');
  log(`Stack trace: ${error.stack || 'No stack trace available'}`, 'error', false);
  process.exit(1);
});