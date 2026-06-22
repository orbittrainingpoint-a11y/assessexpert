// SAST P2 #15 — DTO for the highest-traffic candidate endpoints.
//
// Candidates are the busiest mutation surface for HR roles, and the
// fields are well-defined. Locking the shape here prevents mass-
// assignment-style bugs from extra body fields silently landing in
// the DB (e.g. a future field like `organizationId` slipping past
// the controller's tenant override).

import { Type } from 'class-transformer'
import {
  IsBoolean, IsDateString, IsEmail, IsOptional, IsString, Length, MaxLength, ValidateNested,
} from 'class-validator'

export class CandidateExtraFieldDto {
  @IsString()
  @MaxLength(120)
  key!: string

  // Stored as a JSON value — string is the typical case, but allow
  // null for "field cleared". Numbers/booleans get coerced via the
  // transform on the calling form.
  @IsOptional()
  value?: string | number | boolean | null
}

export class CreateCandidateDto {
  @IsEmail()
  @MaxLength(320)
  email!: string

  @IsString()
  @Length(1, 80)
  firstName!: string

  @IsString()
  @Length(1, 80)
  lastName!: string

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string

  @IsOptional()
  @IsString()
  @MaxLength(120)
  jobPosition?: string

  @IsOptional()
  @IsString()
  @MaxLength(80)
  experience?: string

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string

  // Optional CV link from a CSV import flow; restricted to http(s)
  // URLs at the service layer.
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  cvUrl?: string

  // Birth date as an ISO date string (the frontend serialises
  // through Date.toISOString()).
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string

  // SUPER_ADMIN only — the controller decides whether to honour it.
  @IsOptional()
  @IsString()
  @Length(20, 40)
  organizationId?: string

  // Marketing consent flag from the import flow.
  @IsOptional()
  @IsBoolean()
  consentGdpr?: boolean

  // Custom HR fields beyond the core schema. Each is { key, value }.
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CandidateExtraFieldDto)
  extraFields?: CandidateExtraFieldDto[]
}

// Update accepts the same shape but every field is optional.
// PartialType from @nestjs/mapped-types would cut this in half but
// we avoid the extra dep — the explicit DTO is fine.
export class UpdateCandidateDto {
  @IsOptional()
  @IsEmail()
  @MaxLength(320)
  email?: string

  @IsOptional()
  @IsString()
  @Length(1, 80)
  firstName?: string

  @IsOptional()
  @IsString()
  @Length(1, 80)
  lastName?: string

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string

  @IsOptional()
  @IsString()
  @MaxLength(120)
  jobPosition?: string

  @IsOptional()
  @IsString()
  @MaxLength(80)
  experience?: string

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  cvUrl?: string

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string

  @IsOptional()
  @IsBoolean()
  consentGdpr?: boolean

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CandidateExtraFieldDto)
  extraFields?: CandidateExtraFieldDto[]
}
