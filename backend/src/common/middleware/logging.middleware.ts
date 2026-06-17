import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger(LoggingMiddleware.name);

  use(request: Request, response: Response, next: NextFunction): void {
    const startedAt = Date.now();
    const { ip, method, originalUrl } = request;

    response.on('finish', () => {
      const durationMs = Date.now() - startedAt;

      this.logger.log(
        `${method} ${originalUrl} ${response.statusCode} - ${durationMs}ms - ${ip}`,
      );
    });

    next();
  }
}
