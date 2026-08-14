import { BadRequestException, Injectable } from '@nestjs/common';
import { getPacificTodayDateInputValue } from '../../common/utils/pacific-date.util';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { CreateLeadDto } from './dto/create-lead.dto';
import { QueryLeadsDto } from './dto/query-leads.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { LeadsRepository } from './leads.repository';

@Injectable()
export class LeadsService {
  constructor(private readonly leadsRepository: LeadsRepository) {}

  create(createLeadDto: CreateLeadDto, user: AuthenticatedUser) {
    this.assertPastOrTodayDate(
      createLeadDto.leadDate,
      'Lead date cannot be in the future.',
    );

    return this.leadsRepository.create(createLeadDto, user);
  }

  findAll(queryLeadsDto: QueryLeadsDto, user: AuthenticatedUser) {
    return this.leadsRepository.findAll(queryLeadsDto, user);
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
}
