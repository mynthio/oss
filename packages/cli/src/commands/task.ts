import * as Args from "@effect/cli/Args";
import * as Command from "@effect/cli/Command";
import * as Options from "@effect/cli/Options";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import { TaskService, type TaskData } from "../services/TaskService.ts";

const jsonOption = Options.boolean("json").pipe(
  Options.withDescription("Output machine-readable JSON instead of a human-readable summary"),
);

const taskIdArg = Args.text({ name: "id" }).pipe(Args.withDescription("Task ID"));

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

const renderHuman = Effect.fn("task.renderHuman")(function* (task: TaskData) {
  yield* Console.log(`${statusGlyph(task.status)} Task ${task.id}`);
  yield* Console.log(`  Type:       ${task.type}`);
  yield* Console.log(`  Status:     ${task.status}`);
  if (task.cost !== null) yield* Console.log(`  Cost:       ${task.cost}`);
  yield* Console.log(`  Created:    ${task.createdAt}`);
  yield* Console.log(`  Updated:    ${task.updatedAt}`);

  if (task.result !== null && task.result !== undefined) {
    yield* Console.log("");
    yield* Console.log("Result:");
    yield* Console.log(indent(JSON.stringify(task.result, null, 2), 2));
  }
});

const indent = (text: string, spaces: number): string => {
  const pad = " ".repeat(spaces);
  return text
    .split("\n")
    .map((line) => `${pad}${line}`)
    .join("\n");
};

const get = Command.make("get", { id: taskIdArg, json: jsonOption }, ({ id, json }) =>
  Effect.gen(function* () {
    const tasks = yield* TaskService;
    const task = yield* tasks.getTask(id);

    if (json) {
      yield* Console.log(JSON.stringify(task, null, 2));
      return;
    }

    yield* renderHuman(task);
  }),
);

export const taskCommand = Command.make("task").pipe(Command.withSubcommands([get]));
