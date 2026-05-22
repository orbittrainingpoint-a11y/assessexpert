import {
  Controller, Get, Post, Put, Delete, Body, Param, Req, UseGuards,
  UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import * as path from 'path';
import { CmsService } from './cms.service';
import { StorageService } from '../storage/storage.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

// Roles allowed to manage CMS content. SUPER_ADMIN is included so a
// platform owner can always reach it; the dedicated CMS roles are the
// day-to-day editors.
const CMS_ROLES = ['CMS_ADMIN', 'CMS_EDITOR', 'SUPER_ADMIN'] as const;

@ApiTags('cms')
@Controller('cms')
export class CmsController {
  constructor(
    private cms: CmsService,
    private storage: StorageService,
  ) {}

  // ── PUBLIC READS (no auth) — consumed by the marketing site ─────────

  @Get('public/pages/:slug')
  getPublicPage(@Param('slug') slug: string) {
    return this.cms.getPublicPage(slug);
  }

  @Get('public/posts')
  listPublicPosts() {
    return this.cms.listPublicPosts();
  }

  @Get('public/posts/:slug')
  getPublicPost(@Param('slug') slug: string) {
    return this.cms.getPublicPost(slug);
  }
}

// Admin surface is a separate controller so the guard stack applies to
// every route here and never leaks onto the public reads above.
@ApiTags('cms-admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...CMS_ROLES)
@Controller('cms/admin')
export class CmsAdminController {
  constructor(
    private cms: CmsService,
    private storage: StorageService,
  ) {}

  // Pages
  @Get('pages')
  listPages() {
    return this.cms.listPages();
  }

  @Get('pages/:slug')
  getPage(@Param('slug') slug: string) {
    return this.cms.getPage(slug);
  }

  @Put('pages/:slug')
  upsertPage(@Param('slug') slug: string, @Body() body: any, @Req() req: any) {
    return this.cms.upsertPage(slug, body, req.user?.id);
  }

  // Posts
  @Get('posts')
  listPosts() {
    return this.cms.listPosts();
  }

  @Get('posts/:id')
  getPost(@Param('id') id: string) {
    return this.cms.getPost(id);
  }

  @Post('posts')
  createPost(@Body() body: any, @Req() req: any) {
    return this.cms.createPost(body, req.user?.id);
  }

  @Put('posts/:id')
  updatePost(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.cms.updatePost(id, body, req.user?.id);
  }

  @Delete('posts/:id')
  deletePost(@Param('id') id: string) {
    return this.cms.deletePost(id);
  }

  // Media
  @Get('media')
  listMedia() {
    return this.cms.listMedia();
  }

  @Post('media')
  @UseInterceptors(FileInterceptor('file'))
  async uploadMedia(@UploadedFile() file: Express.Multer.File, @Body() body: any, @Req() req: any) {
    if (!file) throw new BadRequestException('No file provided');
    // Images only — the media library backs page heroes and post covers.
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!this.storage.validateMimeType(file.buffer, allowed)) {
      throw new BadRequestException('Only JPG, PNG, GIF, WEBP images are allowed');
    }
    const filePath = await this.storage.saveFile('cms-media', file.originalname, file.buffer);
    const base = path.resolve(process.env.STORAGE_PATH || './storage');
    const rel = path.relative(base, path.resolve(filePath)).replace(/\\/g, '/');
    const url = `/uploads/${rel}`;
    return this.cms.recordMedia(
      { url, filename: file.originalname, mimeType: file.mimetype, size: file.size, alt: body?.alt },
      req.user?.id,
    );
  }

  @Delete('media/:id')
  deleteMedia(@Param('id') id: string) {
    return this.cms.deleteMedia(id);
  }
}
