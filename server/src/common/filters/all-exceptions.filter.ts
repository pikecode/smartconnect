import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

interface ErrorBody {
  success: false;
  data: null;
  error: { code: string; message: string; details?: unknown };
  meta: null;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL';
    let message = '服务内部错误';
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const resp = exception.getResponse();
      const extracted =
        typeof resp === 'object' && resp !== null ? (resp as Record<string, unknown>) : {};
      code = (extracted.code as string) ?? `HTTP_${status}`;
      message = (extracted.message as string) ?? exception.message;
      details = extracted.details;
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        code = 'BIZ_CONFLICT';
        message = '记录已存在';
      } else if (exception.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        code = 'BIZ_NOT_FOUND';
        message = '资源不存在';
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    if (status >= 500) {
      this.logger.error(message, exception instanceof Error ? exception.stack : undefined);
    }

    const body: ErrorBody = {
      success: false,
      data: null,
      error: { code, message, ...(details ? { details } : {}) },
      meta: null,
    };
    res.status(status).json(body);
  }
}
