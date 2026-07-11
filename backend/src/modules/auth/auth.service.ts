import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Role } from '../../common/enums/role.enum';
import { buildCreatedAtFilter } from '../../common/utils/date-range.util';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { CreateUserDto } from './dto/create-user.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { QueryUsersDto } from './dto/query-users.dto';
import { UpdateUserPasswordDto } from './dto/update-user-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class AuthService {
  private static readonly SALT_ROUNDS = 12;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(
    email: string,
    password: string,
  ): Promise<{
    accessToken: string;
    tokenType: 'Bearer';
    user: AuthenticatedUser;
  }> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.validateUser(normalizedEmail, password);
    const payload: JwtPayload = {
      sub: user.userId,
      email: user.email,
      role: user.role,
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      tokenType: 'Bearer',
      user,
    };
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, AuthService.SALT_ROUNDS);
  }

  async createUser(dto: CreateUserDto) {
    if (![Role.SALES, Role.SHIPPING].includes(dto.role)) {
      throw new BadRequestException(
        'Only sales agents and shipping accounts can be created from the admin workspace.',
      );
    }

    const normalizedEmail = dto.email.trim().toLowerCase();

    const existingUser = await this.prismaService.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw new ConflictException('A user with this email already exists.');
    }

    const passwordHash = await this.hashPassword(dto.password);

    const user = await this.prismaService.user.create({
      data: {
        name: dto.name.trim(),
        email: normalizedEmail,
        passwordHash,
        role: dto.role,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    return user;
  }

  async findAllUsers(queryUsersDto: QueryUsersDto) {
    const createdAtFilter = buildCreatedAtFilter(
      queryUsersDto.createdFrom,
      queryUsersDto.createdTo,
    );

    return this.prismaService.user.findMany({
      where: createdAtFilter
        ? {
            createdAt: createdAtFilter,
          }
        : undefined,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateUserPassword(id: string, dto: UpdateUserPasswordDto) {
    const existingUser = await this.prismaService.user.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existingUser) {
      throw new NotFoundException('User not found.');
    }

    const passwordHash = await this.hashPassword(dto.password);

    return this.prismaService.user.update({
      where: { id },
      data: { passwordHash },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });
  }

  async updateUser(id: string, dto: UpdateUserDto) {
    if (dto.email === undefined && dto.role === undefined) {
      throw new BadRequestException('Email or role is required.');
    }

    const existingUser = await this.prismaService.user.findUnique({
      where: { id },
      select: { id: true, email: true, role: true },
    });

    if (!existingUser) {
      throw new NotFoundException('User not found.');
    }

    if (existingUser.role === Role.ADMIN && dto.role !== undefined) {
      throw new BadRequestException('Admin roles cannot be changed.');
    }

    const normalizedEmail = dto.email?.trim().toLowerCase();

    if (normalizedEmail && normalizedEmail !== existingUser.email) {
      const duplicateUser = await this.prismaService.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true },
      });

      if (duplicateUser) {
        throw new ConflictException('A user with this email already exists.');
      }
    }

    return this.prismaService.user.update({
      where: { id },
      data: {
        email: normalizedEmail,
        role: dto.role,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });
  }

  async deleteUser(id: string) {
    const existingUser = await this.prismaService.user.findUnique({
      where: { id },
      select: {
        id: true,
        role: true,
        _count: {
          select: {
            leads: true,
            orders: true,
            notes: true,
          },
        },
      },
    });

    if (!existingUser) {
      throw new NotFoundException('User not found.');
    }

    if (existingUser.role === Role.ADMIN) {
      throw new BadRequestException('Admin users cannot be deleted.');
    }

    const activityCount =
      existingUser._count.leads +
      existingUser._count.orders +
      existingUser._count.notes;

    if (activityCount > 0) {
      throw new ConflictException(
        'This user has CRM activity and cannot be deleted because its audit history must be preserved.',
      );
    }

    await this.prismaService.user.delete({ where: { id } });

    return { id };
  }

  private async validateUser(
    email: string,
    password: string,
  ): Promise<AuthenticatedUser> {
    const user = await this.prismaService.user.findUnique({
      where: {
        email,
      },
      select: {
        id: true,
        name: true,
        email: true,
        passwordHash: true,
        role: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    return {
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role as Role,
    };
  }
}
