import { Controller, Get, Post, Put, Body, Param, Query, Req, Res, UseGuards, UploadedFile, UseInterceptors, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { parse as csvParse } from 'csv-parse/sync';
import * as XLSX from 'xlsx';
import { QuestionsService } from './questions.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

// Header → row-field mapping. Case-insensitive, accepts a couple of
// reasonable aliases so a hand-edited CSV doesn't fail on capitalisation
// or singular/plural.
const HEADER_ALIASES: Record<string, string> = {
  question: 'questionText',
  questiontext: 'questionText',
  optiona: 'optionA',
  optionb: 'optionB',
  optionc: 'optionC',
  optiond: 'optionD',
  optione: 'optionE',
  correct: 'correctAnswers',
  correctanswer: 'correctAnswers',
  correctanswers: 'correctAnswers',
  difficulty: 'difficulty',
  domain: 'domain',
  topic: 'domain',
  explanation: 'explanation',
  tags: 'tags',
  marks: 'marks',
  points: 'marks',
  language: 'language',
  type: 'type',
  questiontype: 'type',
};

function normaliseHeader(h: string): string {
  return (HEADER_ALIASES[h.trim().toLowerCase().replace(/[\s_-]/g, '')] || '');
}

// Sample CSV — also served by /import/template so users can download
// a ready-to-edit starting point.
const TEMPLATE_CSV = `questionText,optionA,optionB,optionC,optionD,optionE,correctAnswers,difficulty,domain,explanation,tags,marks,language,type
"What does the OSI model's Layer 3 primarily handle?","Physical bits","Data link framing","Routing and logical addressing","Transport segments","Session control","C",EASY,"Networking","Layer 3 is the Network layer — IP, routing, logical addressing.","fundamentals,osi",1,en,MCQ_SINGLE
"Which of these are valid HTTP methods? (select all that apply)","GET","POST","FETCH","DELETE","CONNECT","A,B,D,E",MEDIUM,"Web APIs","FETCH is a JavaScript fetch() call, not an HTTP method.","http,web",2,en,MCQ_MULTI
"TCP guarantees in-order delivery of packets.","True","False",,,,"A",EASY,"Networking","TCP is a reliable, in-order transport protocol.","tcp,protocols",1,en,TRUE_FALSE
`;

@ApiTags('questions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('questions')
export class QuestionsController {
  constructor(private questionsService: QuestionsService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'MASTER_PROCTOR', 'EXAM_SETUP_MASTER', 'PROCTOR')
  async getQuestions(@Query() filters: any) {
    return this.questionsService.getQuestions(filters);
  }

  @Get('pool-stats/:assessmentTypeId')
  @Roles('SUPER_ADMIN', 'MASTER_PROCTOR', 'EXAM_SETUP_MASTER')
  async getPoolStats(@Param('assessmentTypeId') id: string) {
    return this.questionsService.getPoolStats(id);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'MASTER_PROCTOR', 'EXAM_SETUP_MASTER', 'PROCTOR')
  async getQuestion(@Param('id') id: string) {
    return this.questionsService.getQuestion(id);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'MASTER_PROCTOR', 'EXAM_SETUP_MASTER')
  async createQuestion(@Body() body: any, @Req() req: any) {
    return this.questionsService.createQuestion(body, req.user.id);
  }

  @Put(':id')
  @Roles('SUPER_ADMIN', 'MASTER_PROCTOR', 'EXAM_SETUP_MASTER')
  async updateQuestion(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.questionsService.updateQuestion(id, body, req.user.id);
  }

  @Post(':id/archive')
  @Roles('SUPER_ADMIN', 'MASTER_PROCTOR', 'EXAM_SETUP_MASTER')
  async archiveQuestion(@Param('id') id: string) {
    return this.questionsService.archiveQuestion(id);
  }

  @Post(':id/activate')
  @Roles('SUPER_ADMIN', 'MASTER_PROCTOR', 'EXAM_SETUP_MASTER')
  async activateQuestion(@Param('id') id: string) {
    return this.questionsService.activateQuestion(id);
  }

  @Post('bulk-activate')
  @Roles('SUPER_ADMIN', 'MASTER_PROCTOR', 'EXAM_SETUP_MASTER')
  async bulkActivate(@Body() body: { ids?: string[]; assessmentTypeId?: string }) {
    return this.questionsService.bulkActivate(body);
  }

  // GET /api/questions/import/template
  // Serves the CSV template so users can download a ready-to-edit file
  // and never have to guess column names. Public to authenticated
  // users — the file has no organisation data, just the schema.
  @Get('import/template')
  @Roles('SUPER_ADMIN', 'MASTER_PROCTOR', 'EXAM_SETUP_MASTER')
  downloadTemplate(@Res() res: Response) {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="mcq-question-bank-template.csv"');
    res.send(TEMPLATE_CSV);
  }

  // POST /api/questions/import
  // Accepts CSV or XLSX. Parses with a real CSV parser (quoted fields
  // and embedded commas / newlines survive). Headers are read from
  // row 1; column order does not matter. Unknown columns are ignored.
  @Post('import')
  @Roles('SUPER_ADMIN', 'MASTER_PROCTOR', 'EXAM_SETUP_MASTER')
  @UseInterceptors(FileInterceptor('file'))
  async bulkImport(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { assessmentTypeId: string },
    @Req() req: any,
  ) {
    if (!file) throw new BadRequestException('No file provided');
    if (!body?.assessmentTypeId) throw new BadRequestException('assessmentTypeId is required');

    // Parse → array of row objects with normalised keys.
    const rawRows = this.parseImportFile(file);
    if (rawRows.length === 0) {
      throw new BadRequestException('No data rows found in file. Check that row 1 contains headers (questionText, optionA, optionB, ...).');
    }

    return this.questionsService.bulkImport(rawRows, body.assessmentTypeId, req.user.id);
  }

  // Internal helper. Detects CSV vs XLSX by file extension, parses
  // appropriately, then normalises headers so the service layer can
  // consume row objects with stable field names.
  private parseImportFile(file: Express.Multer.File): any[] {
    const name = (file.originalname || '').toLowerCase();
    const isExcel = name.endsWith('.xlsx') || name.endsWith('.xls');

    let records: Record<string, any>[];

    if (isExcel) {
      // XLSX path — read the first sheet as JSON.
      const wb = XLSX.read(file.buffer, { type: 'buffer' });
      const sheetName = wb.SheetNames[0];
      if (!sheetName) return [];
      records = XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets[sheetName], { defval: '' });
    } else {
      // CSV path — csv-parse handles quoted fields, embedded commas,
      // and embedded newlines. Trims whitespace and treats the first
      // row as headers.
      records = csvParse(file.buffer, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true, // Excel-on-Windows tends to write a BOM
        relax_quotes: true,
        relax_column_count: true,
      }) as Record<string, any>[];
    }

    // Normalise header names. Drop unknown columns silently — adding
    // an extra column for human notes should not break the import.
    // String values are also passed through `defangFormula` to defeat
    // CSV/XLSX formula-injection — see SAST P1 #9 below.
    return records.map((rec) => {
      const out: Record<string, any> = {};
      for (const [k, v] of Object.entries(rec)) {
        const norm = normaliseHeader(String(k));
        if (norm) out[norm] = typeof v === 'string' ? defangFormula(v.trim()) : v;
      }
      return out;
    }).filter((r) => r.questionText);
  }
}

// SAST P1 #9 — CSV / XLSX formula injection (a.k.a. "CSV injection",
// CWE-1236). If we accept question text like `=cmd|'/c calc'!A1` or
// `+1+cmd|'/c calc'!A1` and later export it back into a CSV that an
// HR manager opens in Excel/Numbers/Sheets, the cell is interpreted as
// a formula and runs (DDE on Windows, hyperlink-style abuse elsewhere).
// Mitigation pattern from OWASP: prefix any string starting with one of
// the "active" chars — `=`, `+`, `-`, `@`, tab, or carriage return —
// with a single apostrophe. Excel treats `'=cmd` as the literal text
// `=cmd` instead of executing it. The apostrophe is shown by Excel
// only — it's stripped on display — so the question stays readable.
function defangFormula(value: string): string {
  if (!value) return value;
  const first = value.charAt(0);
  if (first === '=' || first === '+' || first === '-' || first === '@' ||
      first === '\t' || first === '\r') {
    return `'${value}`;
  }
  return value;
}
