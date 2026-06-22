// SAST P2 #15 — DTO for the public contact / sales-lead form.
//
// The marketing site's <ContactForm /> POSTs here unauthenticated.
// Without a DTO, anyone could submit oversized payloads, embed
// markup in the message, or stuff the lead row with extra columns.
// Tight max-lengths + IsEmail keep the form sane.

import { IsEmail, IsOptional, IsString, Length, MaxLength } from 'class-validator'

export class CreateLeadDto {
  @IsString()
  @Length(1, 120)
  companyName!: string

  @IsString()
  @Length(2, 120)
  fullName!: string

  // Role free-text — e.g. "HR Director" or "Head of Engineering".
  // Kept optional; the form doesn't always collect it.
  @IsOptional()
  @IsString()
  @MaxLength(120)
  role?: string

  @IsEmail()
  @MaxLength(320)
  email!: string

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string

  // Open-ended ask / context. Cap stops a single submission from
  // dropping a million-character payload into the DB.
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  message?: string

  // Tagging fields some embeds use — kept optional and capped.
  @IsOptional()
  @IsString()
  @MaxLength(120)
  source?: string

  @IsOptional()
  @IsString()
  @MaxLength(120)
  utmCampaign?: string

  @IsOptional()
  @IsString()
  @MaxLength(120)
  utmSource?: string
}
