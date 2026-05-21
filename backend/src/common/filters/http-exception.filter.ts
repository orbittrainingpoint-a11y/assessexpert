import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isProd = process.env.NODE_ENV === 'production';
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error = 'Internal Server Error';
    let details: any = null;

    if (exception instanceof HttpException) {
      // HttpException is something we threw on purpose — its message is
      // safe to surface (it's tailored for the client).
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        message = (exceptionResponse as any).message || message;
        error = (exceptionResponse as any).error || error;
        details = (exceptionResponse as any).details || null;
      }
    } else if (exception instanceof Error) {
      // Unhandled native error (Prisma constraint message, third-party
      // SDK throw, etc). In dev we want the real message + stack so the
      // engineer can debug; in prod we MUST NOT leak schema names,
      // file paths, or SDK internals to the client.
      if (isProd) {
        message = 'Internal server error';
        details = null;
      } else {
        message = exception.message;
        details = exception.stack;
      }
    }

    // Log the error (always with full detail — server-side logs are
    // not exposed to the client).
    this.logger.error(
      `${request.method} ${request.url} - Status: ${status} - Message: ${exception instanceof Error ? exception.message : 'unknown'}`,
      exception instanceof Error ? exception.stack : JSON.stringify(exception),
    );

    // Send response. `details` is only attached in development, never
    // in production — same gate that hides stack traces from clients.
    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      error,
      message,
      ...(!isProd && details ? { details } : {}),
    });
  }
}
