import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SnapshotSchedulerService } from './snapshot-scheduler.service';

const mockSnapshotService = {
  collectSnapshot: vi.fn().mockResolvedValue(undefined),
  cleanupOldSnapshots: vi.fn().mockResolvedValue(undefined),
};

describe('SnapshotSchedulerService', () => {
  let scheduler: SnapshotSchedulerService;

  beforeEach(() => {
    vi.clearAllMocks();
    scheduler = new SnapshotSchedulerService(mockSnapshotService as any);
  });

  describe('handleSnapshotCollection', () => {
    it('should call collectSnapshot on scheduled interval', async () => {
      await scheduler.handleSnapshotCollection();
      expect(mockSnapshotService.collectSnapshot).toHaveBeenCalledTimes(1);
    });

    it('should catch and log errors without throwing', async () => {
      mockSnapshotService.collectSnapshot.mockRejectedValueOnce(new Error('DB connection failed'));

      await expect(scheduler.handleSnapshotCollection()).resolves.not.toThrow();
      expect(mockSnapshotService.collectSnapshot).toHaveBeenCalledTimes(1);
    });
  });

  describe('handleCleanup', () => {
    it('should call cleanupOldSnapshots on scheduled interval', async () => {
      await scheduler.handleCleanup();
      expect(mockSnapshotService.cleanupOldSnapshots).toHaveBeenCalledTimes(1);
    });

    it('should catch and log errors without throwing', async () => {
      mockSnapshotService.cleanupOldSnapshots.mockRejectedValueOnce(new Error('Cleanup failed'));

      await expect(scheduler.handleCleanup()).resolves.not.toThrow();
      expect(mockSnapshotService.cleanupOldSnapshots).toHaveBeenCalledTimes(1);
    });
  });
});
