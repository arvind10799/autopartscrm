import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { CreateLeadDto } from './dto/create-lead.dto';
import { QueryLeadsDto } from './dto/query-leads.dto';
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
}
