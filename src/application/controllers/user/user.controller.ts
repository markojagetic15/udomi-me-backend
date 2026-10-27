import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { UserService } from '@services/user/user.service';
import { UpdateUserDto } from '@application/dto/user/update-user.dto';
import { ShelterApplicationDto } from '@application/dto/user/shelter-application.dto';
import { Pagination, PaginationParams } from '@shared/pagination.helper';
import { Cookies } from '@shared/cookie.helper';

@Controller()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('/me')
  async getMe(@Cookies('token') token: string) {
    const me = await this.userService.getMe(token);
    // Object.assign (not spread) keeps the entity instance, so User.toJSON
    // still strips password/verification_token.
    return Object.assign(me, {
      verification_required: this.userService.verificationRequired(),
    });
  }

  @Put('/me')
  updateMe(@Body() body: UpdateUserDto, @Cookies('token') token: string) {
    return this.userService.updateMe(body, token);
  }

  @Delete('/me')
  async deleteMe(
    @Cookies('token') token: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.userService.deleteMe(token);
    res.clearCookie('token', {
      httpOnly: true,
      sameSite: 'lax',
      secure: res.req.secure,
    });
    return result;
  }

  @Get('/me/export')
  async exportMe(
    @Cookies('token') token: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="udomi-me-data.json"',
    );
    return this.userService.exportMe(token);
  }

  @Get('/me/favorites')
  getMyFavorites(@Cookies('token') token: string) {
    return this.userService.getMyFavorites(token);
  }

  @Put('/me/shelter')
  applyAsShelter(
    @Body() body: ShelterApplicationDto,
    @Cookies('token') token: string,
  ) {
    return this.userService.applyAsShelter(body, token);
  }

  @Post('/me/shelter/withdraw')
  withdrawShelter(@Cookies('token') token: string) {
    return this.userService.withdrawShelter(token);
  }

  @Get('/users/:id')
  getPublicProfile(@Param('id') id: string) {
    return this.userService.getPublicProfile(id);
  }

  @Get('/users/:id/listings')
  getPublicListings(
    @Param('id') id: string,
    @PaginationParams() pagination: Pagination,
  ) {
    return this.userService.getPublicListings(id, pagination);
  }
}
