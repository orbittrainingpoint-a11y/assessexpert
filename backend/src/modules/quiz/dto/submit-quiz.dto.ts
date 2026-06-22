// SAST P1 #8 — DTO for the public quiz submission endpoint.
//
// Was: `@Body() body: any` — no shape validation. Malformed input
// would either crash deeper in Prisma (verbose stack trace = info
// disclosure) or get silently mis-counted by the grader. Now: the
// global ValidationPipe (whitelist: true, transform: true) enforces
// the shape before the handler runs and strips any extra fields.
//
// Kept narrow on purpose. The candidate-facing API should accept
// exactly the fields the service needs and nothing else.

import { Type } from 'class-transformer'
import {
  ArrayMaxSize, ArrayMinSize, ArrayNotEmpty,
  IsArray, IsInt, IsOptional, IsString, Length, Max, Min, ValidateNested,
} from 'class-validator'

export class SubmitQuizAnswerDto {
  // Question id is a cuid (~25 chars). Accept a generous range so
  // future id-scheme changes don't break older clients mid-flight.
  @IsString()
  @Length(8, 64)
  questionId!: string

  // Selected option keys — always 1..5 letters, comes from the
  // MCQ_SINGLE / MCQ_MULTI / TRUE_FALSE choices delivered by
  // /questions. ArrayMinSize=1 prevents empty submissions; max=5
  // matches the option ceiling. Each letter validated by Length.
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @IsString({ each: true })
  @Length(1, 2, { each: true })
  selected!: string[]

  // Optional analytics field. Capped at 24h (~86400) so a clock-
  // skewed client can't write a billion-second value into the DB.
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(86400)
  timeSpentSeconds?: number
}

export class SubmitQuizDto {
  // 1..500 answers — same ceiling as the largest configured assessment
  // type's mcqQuestionCount. Above 500 = malformed payload.
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => SubmitQuizAnswerDto)
  answers!: SubmitQuizAnswerDto[]
}
