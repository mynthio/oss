import * as FileSystem from "@effect/platform/FileSystem";
import * as Path from "@effect/platform/Path";
import * as keychain from "cross-keychain";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { CredentialsStoreError } from "../domain/Errors.ts";
import { Credentials } from "../domain/Schemas.ts";

const SERVICE_NAME = "mynth-cli";
const ACCOUNT_NAME = "default";
const FILE_NAME = "credentials.json";

const storeFail = (message: string) =>
  Effect.mapError((cause: unknown) => new CredentialsStoreError({ message, cause }));

const tryKeychain = <A>(
  fn: () => Promise<A>,
  message: string,
): Effect.Effect<Option.Option<A>, CredentialsStoreError> =>
  Effect.tryPromise({ try: fn, catch: (cause) => cause }).pipe(
    Effect.map(Option.some),
    Effect.catchAll((cause) => {
      const name = (cause as { name?: string } | undefined)?.name;
      if (name === "NoKeyringError" || name === "InitError") {
        return Effect.succeed(Option.none<A>());
      }
      return new CredentialsStoreError({ message, cause });
    }),
  );

const decode = (raw: string): Effect.Effect<Credentials, CredentialsStoreError> =>
  Effect.try({
    try: () => JSON.parse(raw) as unknown,
    catch: (cause) =>
      new CredentialsStoreError({ message: "credentials JSON parse failed", cause }),
  }).pipe(
    Effect.flatMap(Schema.decodeUnknown(Credentials)),
    storeFail("credentials shape invalid"),
  );

const encode = (creds: Credentials): string => JSON.stringify(creds);

const resolveConfigDir = (path: Path.Path): string => {
  const xdg = process.env["XDG_CONFIG_HOME"];
  const base = xdg && xdg.length > 0 ? xdg : path.join(process.env["HOME"] ?? ".", ".config");
  return path.join(base, "mynth");
};

export class CredentialsStore extends Effect.Service<CredentialsStore>()("CredentialsStore", {
  effect: Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;

    const dir = resolveConfigDir(path);
    const file = path.join(dir, FILE_NAME);

    const readFile: Effect.Effect<Option.Option<Credentials>, CredentialsStoreError> = Effect.gen(
      function* () {
        const exists = yield* fs.exists(file).pipe(storeFail("stat credentials file failed"));
        if (!exists) return Option.none<Credentials>();
        const raw = yield* fs.readFileString(file).pipe(storeFail("read credentials file failed"));
        return Option.some(yield* decode(raw));
      },
    );

    const writeFile = Effect.fn("CredentialsStore.writeFile")(function* (creds: Credentials) {
      yield* fs.makeDirectory(dir, { recursive: true }).pipe(storeFail("create config dir failed"));
      yield* fs
        .writeFileString(file, encode(creds))
        .pipe(storeFail("write credentials file failed"));
      yield* fs.chmod(file, 0o600).pipe(Effect.ignore);
    });

    const deleteFile = Effect.gen(function* () {
      const exists = yield* fs.exists(file).pipe(Effect.orElseSucceed(() => false));
      if (!exists) return;
      yield* fs.remove(file).pipe(storeFail("delete credentials file failed"));
    });

    const get: Effect.Effect<Option.Option<Credentials>, CredentialsStoreError> = Effect.gen(
      function* () {
        const fromKeychain = yield* tryKeychain(
          () => keychain.getPassword(SERVICE_NAME, ACCOUNT_NAME),
          "keychain get failed",
        );
        if (Option.isNone(fromKeychain)) return yield* readFile;
        const value = fromKeychain.value;
        if (value === null) return Option.none<Credentials>();
        return Option.some(yield* decode(value));
      },
    );

    const set = Effect.fn("CredentialsStore.set")(function* (creds: Credentials) {
      const wrote = yield* tryKeychain(
        () => keychain.setPassword(SERVICE_NAME, ACCOUNT_NAME, encode(creds)),
        "keychain set failed",
      );
      if (Option.isNone(wrote)) {
        yield* writeFile(creds);
        return;
      }
      // Keychain is the source of truth — clear any stale file fallback.
      yield* deleteFile.pipe(Effect.ignore);
    });

    const clear = Effect.gen(function* () {
      yield* tryKeychain(
        () => keychain.deletePassword(SERVICE_NAME, ACCOUNT_NAME),
        "keychain delete failed",
      ).pipe(Effect.ignore);
      yield* deleteFile.pipe(Effect.ignore);
    });

    const usingKeychain = tryKeychain(() => keychain.getKeyring(), "keychain probe failed").pipe(
      Effect.map((result) => Option.isSome(result) && result.value !== null),
    );

    return {
      get,
      set,
      clear,
      usingKeychain,
      filePath: file,
    } as const;
  }),
}) {}
