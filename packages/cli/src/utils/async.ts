export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Runs `fn` over `items` with at most `limit` in flight, preserving order. */
export const mapLimit = async <A, B>(
  items: ReadonlyArray<A>,
  limit: number,
  fn: (item: A, index: number) => Promise<B>,
): Promise<ReadonlyArray<B>> => {
  const results = Array.from<B>({ length: items.length });
  let next = 0;

  const worker = async (): Promise<void> => {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await fn(items[index]!, index);
    }
  };

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
};
