import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { EinvoiceService } from './einvoice.service';
import {
  CancelDocumentDto,
  CreateEinvoiceConfigDto,
  SubmitInvoiceDto,
  UpdateEinvoiceConfigDto,
} from './dto/config.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '@account/shared';

@ApiTags('einvoice')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('einvoice')
export class EinvoiceController {
  constructor(private readonly svc: EinvoiceService) {}

  // --- Config ---
  @Get('configs')
  configs(@CurrentUser() user: AuthUser) {
    if (!user.accountBookId) throw new Error('User has no account book');
    return this.svc.listConfigs(user.accountBookId);
  }

  @Post('configs')
  upsert(@CurrentUser() user: AuthUser, @Body() dto: CreateEinvoiceConfigDto) {
    if (!user.accountBookId) throw new Error('User has no account book');
    return this.svc.upsertConfig(user.accountBookId, dto);
  }

  @Put('configs/:id')
  update(@Param('id') id: string, @Body() dto: UpdateEinvoiceConfigDto) {
    return this.svc.updateConfig(id, dto);
  }

  @Delete('configs/:id')
  remove(@Param('id') id: string) {
    return this.svc.deleteConfig(id);
  }

  // --- Submissions ---
  @Post('invoices/:id/submit')
  submit(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: SubmitInvoiceDto,
  ) {
    if (!user.accountBookId) throw new Error('User has no account book');
    return this.svc.submitInvoice(user.accountBookId, id, dto);
  }

  @Get('submissions')
  submissions(@CurrentUser() user: AuthUser, @Query('invoiceId') invoiceId?: string) {
    if (!user.accountBookId) throw new Error('User has no account book');
    return this.svc.listSubmissions(user.accountBookId, invoiceId);
  }

  @Get('submissions/:id')
  submission(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    if (!user.accountBookId) throw new Error('User has no account book');
    return this.svc.getSubmission(user.accountBookId, id);
  }

  @Post('submissions/:id/poll')
  poll(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    if (!user.accountBookId) throw new Error('User has no account book');
    return this.svc.pollSubmission(user.accountBookId, id);
  }

  @Post('submissions/:id/cancel')
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CancelDocumentDto,
  ) {
    if (!user.accountBookId) throw new Error('User has no account book');
    return this.svc.cancelDocument(user.accountBookId, id, dto.reason);
  }

  @Post('submissions/:id/reject')
  reject(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CancelDocumentDto,
  ) {
    if (!user.accountBookId) throw new Error('User has no account book');
    return this.svc.rejectDocument(user.accountBookId, id, dto.reason);
  }

  @Get('submissions/:id/document')
  document(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    if (!user.accountBookId) throw new Error('User has no account book');
    return this.svc.getDocument(user.accountBookId, id);
  }

  @Get('submissions/:id/details')
  submissionDetails(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    if (!user.accountBookId) throw new Error('User has no account book');
    return this.svc.getSubmissionDetails(user.accountBookId, id);
  }

  @Get('recent')
  recent(
    @CurrentUser() user: AuthUser,
    @Query('env') env: string = 'SANDBOX',
    @Query('pageNo') pageNo?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    if (!user.accountBookId) throw new Error('User has no account book');
    return this.svc.getRecentDocuments(user.accountBookId, env as never, Number(pageNo ?? 1), Number(pageSize ?? 20));
  }

  @Post('validate-tin')
  validateTin(
    @CurrentUser() user: AuthUser,
    @Body() body: { env?: string; tin: string; idType: string; idValue: string },
  ) {
    if (!user.accountBookId) throw new Error('User has no account book');
    return this.svc.validateTin(user.accountBookId, (body.env ?? 'SANDBOX') as never, body.tin, body.idType, body.idValue);
  }
}
