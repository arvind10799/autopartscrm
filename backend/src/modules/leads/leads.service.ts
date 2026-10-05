import { BadRequestException, Injectable } from '@nestjs/common';
import { NoteEntityType } from '../../common/enums/note-entity-type.enum';
import { getPacificTodayDateInputValue } from '../../common/utils/pacific-date.util';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import {
  buildOrdersExportWorkbook,
  OrdersExportWorkbookInput,
} from '../orders/orders-export-workbook.builder';
import { NotesService } from '../notes/notes.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { QueryLeadsDto } from './dto/query-leads.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { LeadListRecord, LeadsRepository } from './leads.repository';

@Injectable()
export class LeadsService {
  constructor(
    private readonly leadsRepository: LeadsRepository,
    private readonly notesService: NotesService,
  ) {}

  async create(createLeadDto: CreateLeadDto, user: AuthenticatedUser) {
    this.assertPastOrTodayDate(
      createLeadDto.leadDate,
      'Lead date cannot be in the future.',
    );

    const lead = await this.leadsRepository.create(createLeadDto, user);
    const initialComment = createLeadDto.comments?.trim();

    if (initialComment) {
      await this.notesService.create(
        {
          content: initialComment,
          entityId: lead.id,
          entityType: NoteEntityType.LEAD,
        },
        user,
      );
    }

    return lead;
  }

  findAll(queryLeadsDto: QueryLeadsDto, user: AuthenticatedUser) {
    return this.leadsRepository.findAll(queryLeadsDto, user);
  }

  findOne(id: string, user: AuthenticatedUser) {
    return this.leadsRepository.findById(id, user);
  }

  async exportExcel(
    queryLeadsDto: QueryLeadsDto,
    user: AuthenticatedUser,
  ): Promise<Buffer> {
    const leads = await this.leadsRepository.findAllForExport(queryLeadsDto, user);

    return this.buildLeadsWorkbook(leads, queryLeadsDto);
  }

  findLeadAgents() {
    return this.leadsRepository.findLeadAgents();
  }

  async update(
    id: string,
    updateLeadDto: UpdateLeadDto,
    user: AuthenticatedUser,
  ) {
    if (Object.values(updateLeadDto).every((value) => value === undefined)) {
      throw new BadRequestException(
        'At least one lead field must be provided for update.',
      );
    }

    await this.leadsRepository.findEditableById(id, user);

    if (updateLeadDto.leadDate) {
      this.assertPastOrTodayDate(
        updateLeadDto.leadDate,
        'Lead date cannot be in the future.',
      );
    }

    return this.leadsRepository.update(id, updateLeadDto);
  }

  private assertPastOrTodayDate(value: string, message: string): void {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException('Date value is invalid.');
    }

    if (value > getPacificTodayDateInputValue()) {
      throw new BadRequestException(message);
    }
  }

  private buildLeadsWorkbook(
    leads: LeadListRecord[],
    queryLeadsDto: QueryLeadsDto,
  ): Buffer {
    const columns: OrdersExportWorkbookInput['columns'] = [
      { header: 'Lead Date', width: 13 },
      { header: 'Created Date', width: 22 },
      { header: 'Updated Date', width: 22 },
      { header: 'Agent Name', width: 22 },
      { header: 'Agent Email', width: 28 },
      { header: 'Adviser Name', width: 22 },
      { header: 'CMPT', width: 14 },
      { header: 'Customer Name', width: 24 },
      { header: 'Customer Phone', width: 18 },
      { header: 'Customer Email', width: 28 },
      { header: 'State', width: 12 },
      { header: 'Vehicle Year', width: 12 },
      { header: 'Vehicle Make', width: 16 },
      { header: 'Vehicle Model', width: 18 },
      { header: 'Vehicle Variant', width: 18 },
      { header: 'Part Description', width: 32, wrap: true },
      { header: 'Quote', width: 14, money: true },
      { header: 'Currency', width: 10 },
      { header: 'Lead Status', width: 18 },
      { header: 'Converted', width: 12 },
      { header: 'Converted At', width: 22 },
      { header: 'Converted Order', width: 18 },
      { header: 'Comments', width: 44, wrap: true },
      { header: 'Prospects', width: 44, wrap: true },
    ];

    return buildOrdersExportWorkbook({
      columns,
      rows: leads.map((lead) => this.buildLeadExportRow(lead)),
      sheetName: this.buildExportSheetName(queryLeadsDto),
    });
  }

  private buildLeadExportRow(
    lead: LeadListRecord,
  ): Array<string | number | null | undefined> {
    return [
      this.formatDateOnly(lead.leadDate),
      this.formatDateTime(lead.createdAt),
      this.formatDateTime(lead.updatedAt),
      lead.createdBy.name,
      lead.createdBy.email,
      lead.adviserName,
      lead.cmpt,
      lead.customerName,
      lead.customerPhone,
      lead.customerEmail,
      lead.state,
      lead.vehicleYear,
      lead.vehicleMake,
      lead.vehicleModel,
      lead.vehicleVariant,
      lead.partDescription,
      lead.quote ? Number(lead.quote) : null,
      lead.quoteCurrency,
      lead.status,
      lead.convertedAt ? 'Yes' : 'No',
      this.formatDateTime(lead.convertedAt),
      lead.convertedOrder?.orderNumber ?? null,
      lead.comments,
      lead.prospects,
    ];
  }

  private buildExportSheetName(queryLeadsDto: QueryLeadsDto): string {
    const exportDate = this.formatExportDate(new Date());
    const hasActiveFilter = [
      queryLeadsDto.search,
      queryLeadsDto.converted,
      queryLeadsDto.status,
      queryLeadsDto.createdFrom,
      queryLeadsDto.createdTo,
      queryLeadsDto.createdById,
    ].some((value) => value !== undefined && String(value).trim().length > 0);

    return hasActiveFilter
      ? `Filtered Leads ${exportDate}`
      : `All Leads ${exportDate}`;
  }

  private formatDateOnly(value: Date | null | undefined): string {
    if (!value) {
      return '';
    }

    const month = String(value.getUTCMonth() + 1).padStart(2, '0');
    const day = String(value.getUTCDate()).padStart(2, '0');
    const year = value.getUTCFullYear();

    return `${month}/${day}/${year}`;
  }

  private formatDateTime(value: Date | null | undefined): string {
    if (!value) {
      return '';
    }

    return value.toISOString().replace('T', ' ').slice(0, 19);
  }

  private formatExportDate(date: Date): string {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();

    return `${month}-${day}-${year}`;
  }
}
