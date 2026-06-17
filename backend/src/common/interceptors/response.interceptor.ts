import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { map, Observable } from 'rxjs';
import { RESPONSE_MESSAGE_KEY } from '../decorators/response-message.decorator';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T>> {
    const request = context.switchToHttp().getRequest<Request>();
    const customMessage = this.reflector.getAllAndOverride<string>(
      RESPONSE_MESSAGE_KEY,
      [context.getHandler(), context.getClass()],
    );

    return next.handle().pipe(
      map((data) => {
        if (this.isFormattedResponse(data)) {
          return data;
        }

        return {
          success: true,
          data: (data ?? null) as T,
          message: customMessage ?? this.getDefaultMessage(request.method),
        };
      }),
    );
  }

  private getDefaultMessage(method: string): string {
    switch (method.toUpperCase()) {
      case 'POST':
        return 'Resource created successfully.';
      case 'PUT':
      case 'PATCH':
        return 'Resource updated successfully.';
      case 'DELETE':
        return 'Resource deleted successfully.';
      default:
        return 'Request successful.';
    }
  }

  private isFormattedResponse(value: unknown): value is ApiResponse<T> {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const candidate = value as Partial<ApiResponse<T>>;

    return (
      typeof candidate.success === 'boolean' &&
      'data' in candidate &&
      typeof candidate.message === 'string'
    );
  }
}
