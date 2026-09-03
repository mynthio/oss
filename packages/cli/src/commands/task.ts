import { Command } from "commander";
import {
  DEFAULT_WAIT_TIMEOUT_MS,
  getTask,
  getTaskResult,
  listTasks,
  waitForTask,
} from "../api/tasks.ts";
import type { App } from "../app.ts";
import { exitCodeForFailedTask } from "../errors.ts";
import { glyphForStatus, printJson } from "../output/print.ts";
import {
  renderTask,
  renderTaskResult,
  summarizeTask,
  isImageGenerateTask,
} from "../output/render.ts";
import { withSpinner } from "../output/spinner.ts";
import { printTable } from "../output/table.ts";
import { parsePositiveInteger } from "../utils/parse.ts";
import { jsonOption, type JsonFlag } from "./options.ts";

const DEFAULT_WAIT_TIMEOUT_SECONDS = DEFAULT_WAIT_TIMEOUT_MS / 1000;

type DetailedFlag = JsonFlag & { readonly detailed?: boolean };

const detailedOption = (command: Command) =>
  command.option("--detailed", "Include the full task record instead of a compact summary");

export const taskCommand = (app: App): Command => {
  const task = new Command("task").description("Inspect and await Mynth tasks");

  task
    .command("get")
    .description("Fetch a task by ID")
    .argument("<id>", "Task ID")
    .addOption(jsonOption())
    .action(async (id: string, options: JsonFlag) => {
      const data = await getTask(app.api, id);
      if (options.json) {
        printJson(data);
        return;
      }
      renderTask(data);
    });

  // Always JSON: the result payload is the only reason to reach for this over
  // `task get`, so there is no human-readable variant to switch between.
  task
    .command("result")
    .description("Print a task's result payload as JSON")
    .argument("<id>", "Task ID")
    .action(async (id: string) => {
      printJson((await getTaskResult(app.api, id)).result);
    });

  const wait = task
    .command("wait")
    .description("Block until a task completes or fails, then print it")
    .argument("<id>", "Task ID")
    .option(
      "--timeout <seconds>",
      `Max seconds to wait before giving up (default: ${DEFAULT_WAIT_TIMEOUT_SECONDS})`,
      parsePositiveInteger("--timeout"),
    )
    .addOption(jsonOption());
  detailedOption(wait).action(
    async (id: string, options: DetailedFlag & { readonly timeout?: number }) => {
      const pending = waitForTask(
        app.api,
        id,
        (options.timeout ?? DEFAULT_WAIT_TIMEOUT_SECONDS) * 1000,
      );
      const data = options.json ? await pending : await withSpinner(pending);

      // The awaited task's outcome drives the exit code, so scripts can branch
      // on a moderation block without parsing the output.
      if (data.status === "failed") process.exitCode = exitCodeForFailedTask(data);

      if (options.json) {
        const compact = !options.detailed && isImageGenerateTask(data);
        printJson(compact ? summarizeTask(data) : data);
        return;
      }
      renderTaskResult(data);
    },
  );

  task
    .command("list")
    .description("List recent tasks, newest first")
    .option(
      "--limit <number>",
      "Max tasks to return (1-100, default: 20)",
      parsePositiveInteger("--limit"),
    )
    .option("--after <id>", "Cursor: return tasks created before this task ID")
    .addOption(jsonOption())
    .action(async (options: JsonFlag & { readonly limit?: number; readonly after?: string }) => {
      const tasks = await listTasks(app.api, {
        ...(options.limit !== undefined ? { limit: options.limit } : {}),
        ...(options.after !== undefined ? { after: options.after } : {}),
      });

      if (options.json) {
        printJson({ tasks });
        return;
      }

      printTable(
        tasks,
        [
          { header: "", value: (item) => glyphForStatus(item.status) },
          { header: "ID", value: (item) => item.id },
          { header: "Type", value: (item) => item.type },
          { header: "Status", value: (item) => item.status },
          { header: "Cost", value: (item) => item.cost ?? "-" },
          { header: "Created", value: (item) => item.createdAt },
        ],
        "No tasks found.",
      );
    });

  return task;
};
