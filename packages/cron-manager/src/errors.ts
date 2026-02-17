export class CronManagerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CronManagerError';
  }
}

export class CronNotFoundError extends CronManagerError {
  constructor(cronId: string) {
    super(`Cron "${cronId}" not found`);
    this.name = 'CronNotFoundError';
  }
}

export class CronNotInitializedError extends CronManagerError {
  constructor() {
    super('CronManager not initialized. Call initialize() first.');
    this.name = 'CronNotInitializedError';
  }
}

export class CronScheduleError extends CronManagerError {
  constructor(schedule: string, detail: string) {
    super(`Invalid cron schedule "${schedule}": ${detail}`);
    this.name = 'CronScheduleError';
  }
}
