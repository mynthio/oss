export const print = (message = ""): void => {
  process.stdout.write(`${message}\n`);
};

export const printErr = (message = ""): void => {
  process.stderr.write(`${message}\n`);
};
