import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Put,
} from '@nestjs/common';
import { UserService } from '@/services/user/user.service';
import { UpdateUserDto } from '@/application/dto/user/update-user.dto';
import { Pagination, PaginationParams } from '@/shared/pagination.helper';

@Controller()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('/me')
  async getMe(@Headers() headers: { authorization: string }) {
    return this.userService.getMe(headers);
  }

  @Put('/users/:id')
  async updateUser(
    @Param('id') id: string,
    @Body() body: UpdateUserDto,
    @Headers() headers: { authorization: string },
  ) {
    return this.userService.updateUser(id, body, headers);
  }

  @Delete('/users/:id')
  async deleteUser(
    @Param('id') id: string,
    @Headers() headers: { authorization: string },
  ) {
    return this.userService.deleteUser(id, headers);
  }

  @Get('/users/:id/listings')
  async getUserListings(
    @Param('id') id: string,
    @PaginationParams() paginationParams: Pagination,
  ) {
    return this.userService.getUserListings(id, paginationParams);
  }
}
