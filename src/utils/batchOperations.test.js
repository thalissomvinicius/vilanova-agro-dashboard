import { describe, expect, it, vi } from 'vitest';
import { runBatchWithConcurrency } from './batchOperations';

describe('runBatchWithConcurrency', () => {
  it('limits concurrent work and preserves result order', async () => {
    let active = 0;
    let peak = 0;

    const result = await runBatchWithConcurrency(
      [1, 2, 3, 4, 5],
      async (value) => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active -= 1;
        return value * 2;
      },
      { concurrency: 2 }
    );

    expect(peak).toBeLessThanOrEqual(2);
    expect(result.succeeded).toBe(5);
    expect(result.failed).toBe(0);
    expect(result.results.map((entry) => entry.value)).toEqual([2, 4, 6, 8, 10]);
  });

  it('continues after failures and reports incremental progress', async () => {
    const onProgress = vi.fn();

    const result = await runBatchWithConcurrency(
      ['ok-1', 'fail', 'ok-2'],
      async (value) => {
        if (value === 'fail') throw new Error('sem permissao');
        return value;
      },
      { concurrency: 2, onProgress }
    );

    expect(result.succeeded).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.results[1].status).toBe('rejected');
    expect(onProgress).toHaveBeenLastCalledWith({
      completed: 3,
      succeeded: 2,
      failed: 1,
      total: 3,
    });
  });
});
