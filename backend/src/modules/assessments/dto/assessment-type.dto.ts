// SAST P2 #15 — DTO for assessment-type create/update.
//
// AssessmentType is a tenant-defining shape (mcqQuestionCount, time
// limits, pass thresholds). Unvalidated `body: any` allowed callers
// to set arbitrary unknown columns, including `createdBy` (set by
// the controller from req.user.id but spreadable from body before
// this DTO landed) and `status` (which should only flip via the
// dedicated activate / archive routes).

import { IsArray, IsBoolean, IsInt, IsNumber, IsOptional, IsString, Length, Matches, Max, MaxLength, Min } from 'class-validator'

export class CreateAssessmentTypeDto {
  @IsString()
  @Length(2, 120)
  name!: string

  // Short code is used in URL paths / template references — keep it
  // strictly alphanumeric + dashes so a future routing change can't
  // hit a path-traversal-ish surprise.
  @IsString()
  @Length(2, 32)
  @Matches(/^[A-Za-z0-9_-]+$/)
  shortCode!: string

  @IsString()
  @MaxLength(80)
  category!: string

  @IsString()
  @MaxLength(80)
  industry!: string

  @IsString()
  @MaxLength(120)
  jobRole!: string

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string

  @IsOptional() @IsInt() @Min(5) @Max(240)
  mcqTimeLimit?: number

  @IsOptional() @IsInt() @Min(1) @Max(500)
  mcqQuestionCount?: number

  @IsOptional() @IsNumber() @Min(0) @Max(100)
  mcqPassThreshold?: number

  @IsOptional()
  @IsString()
  @Matches(/^(CAD|CODING|LAB|FILE|NONE)$/)
  practicalType?: string

  @IsOptional() @IsInt() @Min(5) @Max(480)
  practicalTimeLimit?: number

  @IsOptional() @IsNumber() @Min(0) @Max(100)
  practicalPassThreshold?: number

  @IsOptional() @IsNumber() @Min(0) @Max(100)
  mcqWeight?: number

  @IsOptional() @IsNumber() @Min(0) @Max(100)
  practicalWeight?: number

  @IsOptional()
  @IsString()
  @Matches(/^(BOTH|EITHER|MCQ_ONLY|PRACTICAL_ONLY)$/)
  overallPassLogic?: string

  @IsOptional() @IsNumber() @Min(0) @Max(100)
  overallPassThreshold?: number

  @IsOptional() @IsBoolean()
  requiresGuardPro?: boolean

  @IsOptional() @IsArray()
  @IsString({ each: true })
  blockedApplications?: string[]

  @IsOptional() @IsBoolean()
  blockMultiMonitor?: boolean

  @IsOptional() @IsBoolean()
  blockVirtualMachines?: boolean

  @IsOptional() @IsBoolean()
  allowClipboard?: boolean

  @IsOptional() @IsArray()
  @IsString({ each: true })
  languages?: string[]
}

// Update accepts every field as optional. shortCode is intentionally
// NOT updatable — it's a stable identifier referenced by URL paths.
export class UpdateAssessmentTypeDto {
  @IsOptional() @IsString() @Length(2, 120)
  name?: string

  @IsOptional() @IsString() @MaxLength(80)
  category?: string

  @IsOptional() @IsString() @MaxLength(80)
  industry?: string

  @IsOptional() @IsString() @MaxLength(120)
  jobRole?: string

  @IsOptional() @IsString() @MaxLength(4000)
  description?: string

  @IsOptional() @IsInt() @Min(5) @Max(240)
  mcqTimeLimit?: number

  @IsOptional() @IsInt() @Min(1) @Max(500)
  mcqQuestionCount?: number

  @IsOptional() @IsNumber() @Min(0) @Max(100)
  mcqPassThreshold?: number

  @IsOptional()
  @IsString()
  @Matches(/^(CAD|CODING|LAB|FILE|NONE)$/)
  practicalType?: string

  @IsOptional() @IsInt() @Min(5) @Max(480)
  practicalTimeLimit?: number

  @IsOptional() @IsNumber() @Min(0) @Max(100)
  practicalPassThreshold?: number

  @IsOptional() @IsNumber() @Min(0) @Max(100)
  mcqWeight?: number

  @IsOptional() @IsNumber() @Min(0) @Max(100)
  practicalWeight?: number

  @IsOptional()
  @IsString()
  @Matches(/^(BOTH|EITHER|MCQ_ONLY|PRACTICAL_ONLY)$/)
  overallPassLogic?: string

  @IsOptional() @IsNumber() @Min(0) @Max(100)
  overallPassThreshold?: number

  @IsOptional() @IsBoolean()
  requiresGuardPro?: boolean

  @IsOptional() @IsArray() @IsString({ each: true })
  blockedApplications?: string[]

  @IsOptional() @IsBoolean()
  blockMultiMonitor?: boolean

  @IsOptional() @IsBoolean()
  blockVirtualMachines?: boolean

  @IsOptional() @IsBoolean()
  allowClipboard?: boolean

  @IsOptional() @IsArray() @IsString({ each: true })
  languages?: string[]
}
