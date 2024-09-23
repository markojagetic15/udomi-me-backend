import { Request } from 'express';
import { Body, Controller, Delete, Get, Param, Put, Req } from '@nestjs/common';
import { UserService } from '@/services/user/user.service';
import { UpdateUserDto } from '../../dto/user/update-user.dto';

@Controller('/api')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('/me')
  async getMe(@Req() req: Request) {
    return this.userService.getMe(req);
  }

  @Put('/users/:id')
  async updateUser(@Param('id') id: string, @Body() body: UpdateUserDto) {
    return this.userService.updateUser(id, body);
  }

  @Delete('/users/:id')
  async deleteUser(@Param('id') id: string) {
    return this.userService.deleteUser(id);
  }
}
