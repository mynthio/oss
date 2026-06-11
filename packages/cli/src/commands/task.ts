import { Command } from "commander";
import type { CliContext } from "../context.ts";
import type { TaskData } from "../services/TaskService.ts";
import { print } from "../utils/output.ts";

type JsonOption = {
  readonly json?: boolean;
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

  return task;
};
