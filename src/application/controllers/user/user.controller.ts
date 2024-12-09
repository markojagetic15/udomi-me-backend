import { Body, Controller, Delete, Get, Param, Put } from '@nestjs/common';
import { UserService } from '@services/user/user.service';
import { UpdateUserDto } from '@application/dto/user/update-user.dto';
import { Pagination, PaginationParams } from '@shared/pagination.helper';
import { Cookies } from '@shared/cookie.helper';

@Controller()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('/me')
  async getMe(@Cookies('token') token: string) {
    return this.userService.getMe(token);
  }

  @Put('/users/:id')
  async updateUser(
    @Param('id') id: string,
    @Body() body: UpdateUserDto,
    @Cookies('token') token: string,
  ) {
    return this.userService.updateUser(id, body, token);
  }

  @Delete('/users/:id')
  async deleteUser(@Param('id') id: string, @Cookies('token') token: string) {
    return this.userService.deleteUser(id, token);
  }

  @Get('/users/:id/listings')
  async getUserListings(
    @Param('id') id: string,
    @PaginationParams() paginationParams: Pagination,
  ) {
    return this.userService.getUserListings(id, paginationParams);
  }

  @Get('/user/:id')
  async getUser(@Param('id') id: string) {
    return this.userService.getUser(id);
  }
}
