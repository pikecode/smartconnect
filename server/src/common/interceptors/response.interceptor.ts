import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

interface Envelope<T> {
  success: boolean;
  data: T | null;
  error: { code: string; message: string; details?: unknown } | null;
  meta: { pagination?: { page: number; page_size: number; total: number } } | null;
}

interface Paginated {
  items?: unknown[];
  total?: number;
  page?: number;
  page_size?: number;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<unknown, Envelope<T>> {
  intercept(
    _ctx: ExecutionContext,
    next: CallHandler<unknown>,
  ): Observable<Envelope<T>> {
    return next.handle().pipe(
      map((raw) => {
        const data = (raw ?? null) as Record<string, unknown> | null;
        // 检测分页响应: { items, total, page, page_size }
        const paginated = data as Paginated | null;
        if (paginated?.items && typeof paginated.total === 'number') {
          const { items, total, page, page_size, ...rest } = paginated;
          const merged = { items, ...rest };
          return {
            success: true,
            data: (Object.keys(merged).length > 1 ? merged : items) as unknown as T | null,
            error: null,
            meta: { pagination: { page: page ?? 1, page_size: page_size ?? 20, total } },
          };
        }
        return {
          success: true,
          data: data as T | null,
          error: null,
          meta: null,
        };
      }),
    );
  }
}
