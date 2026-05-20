import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import * as cookieParser from 'cookie-parser';
import * as path from 'path';
import helmet from 'helmet';
import * as compression from 'compression';

async function bootstrap() {
  // Refuse to boot without a real JWT_SECRET. The previous behaviour
  // silently fell back to the literal string 'fallback-secret' when the
  // env var was missing — anyone reading the repo could forge admin
  // tokens against a misconfigured deployment. Crash loudly instead.
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    // eslint-disable-next-line no-console
    console.error(
      '\n[FATAL] JWT_SECRET is missing or too short (need ≥32 chars).\n' +
      'Generate one with `openssl rand -hex 32` and set it in backend/.env.\n',
    );
    process.exit(1);
  }
  if (!process.env.JWT_REFRESH_SECRET || process.env.JWT_REFRESH_SECRET.length < 32) {
    // eslint-disable-next-line no-console
    console.error(
      '\n[FATAL] JWT_REFRESH_SECRET is missing or too short (need ≥32 chars).\n' +
      'Set a second random secret in backend/.env (must differ from JWT_SECRET).\n',
    );
    process.exit(1);
  }

  // Disable the default body parser (100KB JSON limit) so we can install
  // our own with a roomier ceiling. Several endpoints accept base64-
  // encoded webcam frames (ID verification capture, periodic FR check,
  // reference-photo upload) which routinely run 200-400KB — the default
  // limit was rejecting them with a 500 right at the moment the proctor
  // tried to capture a face. 10MB is comfortable for any single still
  // frame at 1080p and well below what multer handles for chunk uploads.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const bodyParser = require('body-parser');
  app.use(bodyParser.json({ limit: '10mb' }));
  app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

  // Serve uploaded files (question images, practical assets) at /uploads/*
  // Storage dir layout: ./storage/question-assets/*, ./storage/practical-files/*, etc.
  app.useStaticAssets(path.resolve(process.env.STORAGE_PATH || './storage'), {
    prefix: '/uploads/',
  });

  // Security headers. We mostly serve a JSON API + uploads, so the CSP
  // only needs to be permissive enough for Swagger UI in dev. The
  // frontend (Next.js) sets its own CSP; this one protects the API
  // origin's own surface (Swagger, /uploads/*).
  //
  // - img-src 'self' data: blob: — Swagger embeds inline image data, and
  //   uploaded screenshots are served from this origin.
  // - script-src 'self' 'unsafe-inline' — Swagger injects an inline
  //   bootstrap script. Restrict to 'self' only when Swagger is off.
  // - object-src 'none' — no Flash/PDF object embedding ever.
  // - frame-ancestors 'none' — refuses to be iframed (clickjacking).
  const isProd = process.env.NODE_ENV === 'production';
  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: isProd ? ["'self'"] : ["'self'", "'unsafe-inline'"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
      },
    },
    // Force HTTPS once we're behind TLS termination. Disabled in dev so
    // localhost without certs keeps working.
    hsts: isProd ? { maxAge: 31536000, includeSubDomains: true, preload: false } : false,
    // Block other origins from poking at our resources via the
    // legacy Cross-Origin-Resource-Policy header. Same-origin is enough
    // — the frontend already shares the same origin via the Apache
    // reverse-proxy in production.
    crossOriginResourcePolicy: { policy: 'same-origin' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  }));
  app.use(compression());
  app.use(cookieParser());

  // CORS
  app.enableCors({
    origin: [
      process.env.FRONTEND_URL || 'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  // Global prefix
  app.setGlobalPrefix('api');

  // Global exception filter
  app.useGlobalFilters(new AllExceptionsFilter());

  // Validation
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: false,
  }));

  // Swagger docs (development only)
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('assessexpert API')
      .setDescription('B2B SaaS Pre-Employment Assessment Platform API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`assessexpert API running on port ${port}`);
  console.log(`Swagger docs: http://localhost:${port}/api/docs`);
}

bootstrap();
