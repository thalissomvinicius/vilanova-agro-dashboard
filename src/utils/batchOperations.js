export async function runBatchWithConcurrency(
  items,
  worker,
  { concurrency = 3, onProgress } = {}
) {
  const queue = Array.isArray(items) ? items : [];
  const results = new Array(queue.length);
  const workerCount = Math.min(
    queue.length,
    Math.max(1, Math.floor(Number(concurrency) || 1))
  );
  let nextIndex = 0;
  let completed = 0;
  let succeeded = 0;
  let failed = 0;

  const reportProgress = () => {
    onProgress?.({
      completed,
      succeeded,
      failed,
      total: queue.length,
    });
  };

  reportProgress();

  const runners = Array.from({ length: workerCount }, async () => {
    while (nextIndex < queue.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;

      try {
        const value = await worker(queue[currentIndex], currentIndex);
        results[currentIndex] = { status: 'fulfilled', value };
        succeeded += 1;
      } catch (reason) {
        results[currentIndex] = { status: 'rejected', reason };
        failed += 1;
      } finally {
        completed += 1;
        reportProgress();
      }
    }
  });

  await Promise.all(runners);

  return {
    results,
    completed,
    succeeded,
    failed,
    total: queue.length,
  };
}
