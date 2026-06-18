import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class OrganizationsService {
  constructor(private prisma: PrismaService) {}

  async getOrganizations(filters?: any) {
    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { primaryContactEmail: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    const [orgs, total] = await Promise.all([
      this.prisma.organization.findMany({
        where,
        include: { _count: { select: { users: true, candidates: true, sessions: true } } },
        orderBy: { createdAt: 'desc' },
        take: Math.min(parseInt(filters?.limit) || 50, 500),
        skip: parseInt(filters?.offset) || 0,
      }),
      this.prisma.organization.count({ where }),
    ]);
    return { organizations: orgs, total };
  }

  async getOrganization(id: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        users: { select: { id: true, firstName: true, lastName: true, email: true, role: true, status: true } },
        _count: { select: { candidates: true, sessions: true, reports: true } },
      },
    });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async createOrganization(data: any) {
    const slug = data.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
    return this.prisma.organization.create({
      data: { ...data, slug: `${slug}-${Date.now()}` },
    });
  }

  async updateOrganization(id: string, data: any) {
    await this.getOrganization(id);
    return this.prisma.organization.update({ where: { id }, data });
  }

  async suspendOrganization(id: string, reason: string) {
    return this.prisma.organization.update({
      where: { id },
      data: { status: 'SUSPENDED', internalNotes: reason },
    });
  }

  // ── Branding ────────────────────────────────────────────────────────────
  //
  // White-label co-branding so each org can put their own logo + name on
  // the HR portal and on the candidate-facing pages they invite people to.
  // Uses the existing Organization.logo (string URL/path) and
  // brandingConfig (JSON blob for ancillary settings like brand color,
  // displayName overrides). No DB migration required.

  /** Read just the public-safe branding payload (no internal columns). */
  async getBranding(organizationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true, tradingName: true, logo: true, brandingConfig: true },
    });
    if (!org) throw new NotFoundException('Organization not found');
    return {
      organizationId: org.id,
      displayName: org.tradingName || org.name,
      logoUrl: org.logo || null,
      brandColor: (org.brandingConfig as any)?.brandColor || null,
      // Surface the legal name separately so the candidate UI can show
      // both "Brand X — by Legal Y" if the operator wants it.
      legalName: org.name,
    };
  }

  /** Org-scoped update — only HR managers + org admins for this org. */
  async updateBranding(
    organizationId: string,
    body: { logoUrl?: string | null; brandColor?: string | null; displayName?: string | null },
  ) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { brandingConfig: true },
    });
    if (!org) throw new NotFoundException('Organization not found');

    const cfg: any = (org.brandingConfig as any) || {};
    if (body.brandColor !== undefined) {
      // Allow null to clear. Validate hex; reject anything else to keep the
      // value safe to interpolate into CSS without escaping.
      if (body.brandColor === null) delete cfg.brandColor;
      else if (/^#[0-9a-fA-F]{6}$/.test(body.brandColor)) cfg.brandColor = body.brandColor;
    }

    const update: any = { brandingConfig: cfg };
    if (body.logoUrl !== undefined) update.logo = body.logoUrl;          // null clears
    if (body.displayName !== undefined) update.tradingName = body.displayName;

    await this.prisma.organization.update({ where: { id: organizationId }, data: update });
    return this.getBranding(organizationId);
  }

  async getDashboardStats() {
    const [totalActive, totalSuspended, totalTrial] = await Promise.all([
      this.prisma.organization.count({ where: { status: 'ACTIVE' } }),
      this.prisma.organization.count({ where: { status: 'SUSPENDED' } }),
      this.prisma.organization.count({ where: { status: 'TRIAL' } }),
    ]);
    return { totalActive, totalSuspended, totalTrial, total: totalActive + totalSuspended + totalTrial };
  }
}
