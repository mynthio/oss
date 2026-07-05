import { Command } from "commander";
import type { CliContext } from "../context.ts";
import { CliUsageError } from "../domain/Errors.ts";
import type { TaskData, TaskListItem } from "../services/TaskService.ts";
import { print } from "../utils/output.ts";
import { withSpinner } from "../utils/spinner.ts";
import { renderTaskHuman, summarizeTask } from "./image.ts";

const DEFAULT_WAIT_TIMEOUT_SECONDS = 300;

type JsonOption = {
  readonly json?: boolean;
};

type WaitOptions = JsonOption & {
  readonly timeout?: number;
  readonly detailed?: boolean;
};

type ListOptions = JsonOption & {
  readonly limit?: number;
  readonly after?: string;
};

const parsePositiveInteger = (label: string) => (value: string) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || String(parsed) !== value || parsed <= 0) {
    throw new CliUsageError(`invalid ${label}: "${value}" (expected a positive integer)`);
  }
  return parsed;
};

const statusGlyph = (status: string): string => {
  switch (status) {
    case "completed":
      return "✓";
    case "failed":
      return "✗";
    default:
      return "…";
  }
};

const indent = (text: string, spaces: number): string => {
  const pad = " ".repeat(spaces);
  return text
    .split("\n")
    .map((line) => `${pad}${line}`)
    .join("\n");
};

const renderHuman = (task: TaskData): void => {
  print(`${statusGlyph(task.status)} Task ${task.id}`);
  print(`  Type:       ${task.type}`);
  print(`  Status:     ${task.status}`);
  if (task.cost !== null) print(`  Cost:       ${task.cost}`);
  print(`  Created:    ${task.createdAt}`);
  print(`  Updated:    ${task.updatedAt}`);

  if (task.result !== null && task.result !== undefined) {
    print("");
    print("Result:");
    print(indent(JSON.stringify(task.result, null, 2), 2));
  }
};

const renderListHuman = (tasks: ReadonlyArray<TaskListItem>): void => {
  if (tasks.length === 0) {
    print("No tasks found.");
    return;
  }
  for (const task of tasks) {
    const cost = task.cost !== null ? `  ${task.cost}` : "";
    print(
      `${statusGlyph(task.status)} ${task.id}  ${task.type}  ${task.status}${cost}  ${task.createdAt}`,
    );
  }
};

export const createTaskCommand = (ctx: CliContext): Command => {
  const task = new Command("task");

  task
    .command("get")
    .description("Fetch a task by ID")
    .argument("<id>", "Task ID")
    .option("--json", "Output machine-readable JSON instead of a human-readable summary")
    .action(async (id: string, options: JsonOption) => {
      const data = await ctx.tasks.getTask(id);
      if (options.json) {
        print(JSON.stringify(data, null, 2));
        return;
      }
      renderHuman(data);
    });

  task
    .command("wait")
    .description("Block until a task completes (or fails), then print it")
    .argument("<id>", "Task ID")
    .option(
      "--timeout <seconds>",
      `Max seconds to wait before giving up (default: ${DEFAULT_WAIT_TIMEOUT_SECONDS})`,
      parsePositiveInteger("--timeout"),
    )
    .option("--detailed", "Include full task data (all fields) in the output")
    .option("--json", "Output machine-readable JSON instead of a human-readable summary")
    .action(async (id: string, options: WaitOptions) => {
      const timeoutMs = (options.timeout ?? DEFAULT_WAIT_TIMEOUT_SECONDS) * 1000;
      const wait = ctx.tasks.waitForTask(id, timeoutMs);
      const data = options.json ? await wait : await withSpinner(wait);

      if (data.status === "failed") process.exitCode = 1;

      // image.generate output matches sync `image generate`; other task types
      // fall back to the `task get` rendering.
      if (options.json) {
        const payload =
          options.detailed || data.type !== "image.generate" ? data : summarizeTask(data);
        print(JSON.stringify(payload, null, 2));
        return;
      }
      if (data.type === "image.generate" && data.status === "completed") {
        renderTaskHuman(data, 0);
        return;
      }
      renderHuman(data);
    });

  task
    .command("list")
    .description("List recent tasks, newest first")
    .option(
      "--limit <number>",
      "Max tasks to return (1-100, default: 20)",
      parsePositiveInteger("--limit"),
    )
    .option("--after <id>", "Cursor: return tasks created before this task ID")
    .option("--json", "Output machine-readable JSON instead of a human-readable summary")
    .action(async (options: ListOptions) => {
      const tasks = await ctx.tasks.listTasks({
        ...(options.limit !== undefined ? { limit: options.limit } : {}),
        ...(options.after !== undefined ? { after: options.after } : {}),
      });
      if (options.json) {
        print(JSON.stringify({ tasks }, null, 2));
        return;
      }
      renderListHuman(tasks);
    });

  return task;
};
