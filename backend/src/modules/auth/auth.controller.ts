import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { AuthService } from './auth.service';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RoleGuard } from './role.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ResponseMessage('Login successful.')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto.email, loginDto.password);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ResponseMessage('Authenticated user retrieved successfully.')
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  @Roles(Role.ADMIN)
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Post('users')
  @ResponseMessage('User created successfully.')
  async createUser(@Body() createUserDto: CreateUserDto) {
    return this.authService.createUser(createUserDto);
  }

  @Roles(Role.ADMIN)
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Get('users')
  @ResponseMessage('Users retrieved successfully.')
  async getUsers(@Query() queryUsersDto: QueryUsersDto) {
    return this.authService.findAllUsers(queryUsersDto);
  }

  @Roles(Role.ADMIN)
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Get('admin')
  @ResponseMessage('Admin route access granted.')
  getAdminOnlySample() {
    return {
      message: 'Admin route access granted.',
    };
  }
}
