import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SnapshotSchedulerService } from './snapshot-scheduler.service';

const mockSnapshotService = {
  collectSnapshot: vi.fn(),
  cleanupOldSnapshots: vi.fn(),
};

describe('SnapshotSchedulerService', () => {
  let scheduler: SnapshotSchedulerService;

  beforeEach(() => {
    vi.clearAllMocks();
    scheduler = new SnapshotSchedulerService(mockSnapshotService as any);
  });

  it('should call collectSnapshot on scheduled interval', async () => {
    await scheduler.handleSnapshotCollection();
    expect(mockSnapshotService.collectSnapshot).toHaveBeenCalledTimes(1);
  });

  it('should call cleanupOldSnapshots on scheduled interval', async () => {
    await scheduler.handleCleanup();
    expect(mockSnapshotService.cleanupOldSnapshots).toHaveBeenCalledTimes(1);
  });
});
