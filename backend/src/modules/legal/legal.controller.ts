import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('legal')
@Controller('legal')
export class LegalController {
  constructor(private prisma: PrismaService) {}

  // Public — candidates need to read T&C / Privacy on the OTP screen before
  // they have a JWT. Content is edited by admins via /admin/settings.
  @Get('public')
  async getPublishedLegalContent() {
    const rows = await this.prisma.platformSettings.findMany({
      where: { key: { in: ['terms_and_conditions', 'privacy_policy'] } },
    });
    const map = rows.reduce((acc, r) => ({ ...acc, [r.key]: r.value }), {} as Record<string, any>);
    return {
      termsAndConditions: typeof map.terms_and_conditions === 'string' ? map.terms_and_conditions : '',
      privacyPolicy: typeof map.privacy_policy === 'string' ? map.privacy_policy : '',
      updatedAt: rows.length
        ? rows.reduce((latest, r) => (r.updatedAt > latest ? r.updatedAt : latest), rows[0].updatedAt)
        : null,
    };
  }
}
