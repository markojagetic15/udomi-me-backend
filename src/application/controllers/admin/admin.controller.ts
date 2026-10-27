import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsBoolean, IsEmail, IsIn, IsString, Length } from 'class-validator';
import { AdminService } from '@services/admin/admin.service';
import { Pagination, PaginationParams } from '@shared/pagination.helper';
import { Cookies } from '@shared/cookie.helper';

class ResolveReportDto {
  @IsIn(['dismiss', 'hide_listing', 'ban_user'])
  action: 'dismiss' | 'hide_listing' | 'ban_user';
}

class DeleteUserDto {
  // Must equal the target's email — typed by the admin as a confirmation.
  @IsEmail()
  confirm_email: string;
}

class AdminMessageDto {
  @IsString()
  @Length(1, 2000)
  body: string;
}

const AUDIENCES = ['all', 'shelters', 'posters'] as const;

class BroadcastDto extends AdminMessageDto {
  @IsIn(AUDIENCES)
  audience: (typeof AUDIENCES)[number];
}

class ReviewShelterDto {
  @IsBoolean()
  approve: boolean;
}

// Every route is admin-only — enforced in AdminService via requireAdmin.
@Controller('/admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('/stats')
  stats(@Cookies('token') token: string) {
    return this.adminService.stats(token);
  }

  @Get('/reports')
  reports(
    @Cookies('token') token: string,
    @Query('status') status = 'open',
    @PaginationParams() pagination: Pagination,
  ) {
    return this.adminService.reports(token, status, pagination);
  }

  @Post('/reports/:id/resolve')
  resolve(
    @Param('id') id: string,
    @Body() body: ResolveReportDto,
    @Cookies('token') token: string,
  ) {
    return this.adminService.resolveReport(token, id, body.action);
  }

  @Post('/listings/:id/hide')
  hide(@Param('id') id: string, @Cookies('token') token: string) {
    return this.adminService.setListingHidden(token, id, true);
  }

  @Post('/listings/:id/unhide')
  unhide(@Param('id') id: string, @Cookies('token') token: string) {
    return this.adminService.setListingHidden(token, id, false);
  }

  @Get('/users')
  users(
    @Cookies('token') token: string,
    @Query() query: { search?: string; filter?: string },
    @PaginationParams() pagination: Pagination,
  ) {
    return this.adminService.users(token, query, pagination);
  }

  @Get('/users/:id')
  userDetail(@Param('id') id: string, @Cookies('token') token: string) {
    return this.adminService.userDetail(token, id);
  }

  @Post('/users/:id/ban')
  ban(@Param('id') id: string, @Cookies('token') token: string) {
    return this.adminService.setUserBanned(token, id, true);
  }

  @Post('/users/:id/unban')
  unban(@Param('id') id: string, @Cookies('token') token: string) {
    return this.adminService.setUserBanned(token, id, false);
  }

  @Delete('/users/:id')
  @Throttle({ default: { limit: 20, ttl: 60 * 60_000 } })
  deleteUser(
    @Param('id') id: string,
    @Body() body: DeleteUserDto,
    @Cookies('token') token: string,
  ) {
    return this.adminService.deleteUser(token, id, body.confirm_email);
  }

  @Post('/users/:id/message')
  @Throttle({ default: { limit: 60, ttl: 60 * 60_000 } })
  messageUser(
    @Param('id') id: string,
    @Body() body: AdminMessageDto,
    @Cookies('token') token: string,
  ) {
    return this.adminService.messageUser(token, id, body.body);
  }

  @Get('/broadcast/count')
  broadcastCount(
    @Query('audience') audience: string,
    @Cookies('token') token: string,
  ) {
    return this.adminService.broadcastCount(token, audience ?? 'all');
  }

  @Post('/broadcast')
  @Throttle({ default: { limit: 5, ttl: 60 * 60_000 } })
  broadcast(@Body() body: BroadcastDto, @Cookies('token') token: string) {
    return this.adminService.broadcast(token, body.audience, body.body);
  }

  @Get('/listings')
  listings(
    @Cookies('token') token: string,
    @Query() query: { search?: string; status?: string; type?: string },
    @PaginationParams() pagination: Pagination,
  ) {
    return this.adminService.listings(token, query, pagination);
  }

  @Get('/listings/:id')
  listingDetail(@Param('id') id: string, @Cookies('token') token: string) {
    return this.adminService.listingDetail(token, id);
  }

  @Delete('/listings/:id')
  @Throttle({ default: { limit: 60, ttl: 60 * 60_000 } })
  deleteListing(@Param('id') id: string, @Cookies('token') token: string) {
    return this.adminService.deleteListing(token, id);
  }

  @Get('/activity')
  activity(
    @Cookies('token') token: string,
    @PaginationParams() pagination: Pagination,
  ) {
    return this.adminService.activity(token, pagination);
  }

  @Get('/shelters/pending')
  pendingShelters(@Cookies('token') token: string) {
    return this.adminService.pendingShelters(token);
  }

  @Post('/shelters/:id/review')
  reviewShelter(
    @Param('id') id: string,
    @Body() body: ReviewShelterDto,
    @Cookies('token') token: string,
  ) {
    return this.adminService.reviewShelter(token, id, body.approve);
  }
}
