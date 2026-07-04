import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { Paginated } from '../../common/utils/pagination';
import type { SessionUser } from '../auth/session-user.type';
import { RegisterUserDto } from './dto/register-user.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import type { UserDto } from './dto/user.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getMe(@CurrentUser() user: SessionUser): Promise<UserDto> {
    return this.usersService.getMe(user.id);
  }

  @Patch('me')
  updateMe(
    @CurrentUser() user: SessionUser,
    @Body() dto: UpdateMeDto,
  ): Promise<UserDto> {
    return this.usersService.updateMe(user.id, dto);
  }

  @Post('register')
  register(
    @CurrentUser() user: SessionUser,
    @Body() dto: RegisterUserDto,
  ): Promise<UserDto> {
    return this.usersService.register(user, dto);
  }

  @Get()
  @Roles('admin')
  list(
    @Query('page') page?: string,
    @Query('search') search?: string,
  ): Promise<Paginated<UserDto>> {
    return this.usersService.list(page, search);
  }

  @Patch(':id')
  @Roles('admin')
  updateRole(
    @CurrentUser() user: SessionUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
  ): Promise<UserDto> {
    return this.usersService.updateRole(user, id, dto.role);
  }
}
