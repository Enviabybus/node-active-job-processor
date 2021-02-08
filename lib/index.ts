/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextFunction, Request } from 'express';
import fs from 'fs';
import path from 'path';

// #region typings
interface FixedBackoffOptions {
  type: 'fixed';
  delay: number; // Backoff delay in milliseconds
}

interface ExponentialBackoffOptions {
  type: 'exponential';
  delay: number; // Backoff delay in milliseconds
  maxDelay?: number; // The max delay in melliseconds. It will double until it reaches this number.
}

export interface ActiveJob {
  name: string;
  perform: (...args: any[]) => unknown;
  // options
  retryConfig?: {
    attempts: number;
    backoff: number | FixedBackoffOptions | ExponentialBackoffOptions;
  };
}

export interface ActiveJobProcessorAdapter {
  addJob: (job: ActiveJob) => void;
  performAt: (date: Date, job: ActiveJob, args?: unknown[]) => void;
  performIn: (milliseconds: number, job: ActiveJob, args?: unknown[]) => void;
  performLater: (job: ActiveJob, args?: unknown[]) => void;
  middlewares?: ((req: Request, res: any, next: NextFunction) => void)[];
}
// #endregion typings

const jobs: ActiveJob[] = [];

export function initActiveJobProcessor(jobsDirPath: string): void {
  fs.readdirSync(jobsDirPath).forEach((file) => {
    if (!['.js', '.ts'].includes(path.extname(file))) { return; }
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const job = require(path.resolve(jobsDirPath, file)).default;
    jobs.push(job);
  });
}

export class ActiveJobProcessor {
  adapter: ActiveJobProcessorAdapter;

  constructor(adapter: ActiveJobProcessorAdapter) {
    this.adapter = adapter;
    jobs.forEach((j) => adapter.addJob(j));
  }

  get middlewares(): ((req: Request, res: any, next: NextFunction) => void)[] {
    const { middlewares } = this.adapter;
    if (middlewares) { return middlewares; }

    const emptyMid = async (req: Request, res: any, next: NextFunction): Promise<void> => {
      next();
    };

    return [emptyMid];
  }

  performAt(date: Date, job: ActiveJob, args: unknown[] = []): void {
    this.adapter.performAt(date, job, args);
  }

  performIn(milliseconds: number, job: ActiveJob, args: unknown[] = []): void {
    this.adapter.performIn(milliseconds, job, args);
  }

  performLater(job: ActiveJob, args: unknown[] = []): void {
    this.adapter.performLater(job, args);
  }

  async performNow(job: ActiveJob, args: unknown[] = []): Promise<void> {
    await job.perform(...args);
  }
}

export default ActiveJobProcessor;
