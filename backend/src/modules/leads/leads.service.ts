import { BadRequestException, Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { CreateLeadDto } from './dto/create-lead.dto';
import { QueryLeadsDto } from './dto/query-leads.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { LeadsRepository } from './leads.repository';

@Injectable()
export class LeadsService {
  constructor(private readonly leadsRepository: LeadsRepository) {}

  create(createLeadDto: CreateLeadDto, user: AuthenticatedUser) {
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

    return this.leadsRepository.update(id, updateLeadDto);
  }
}
