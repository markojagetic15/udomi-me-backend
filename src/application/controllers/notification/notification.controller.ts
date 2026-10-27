import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { IsObject, IsString, Length } from 'class-validator';
import { NotificationService } from '@services/notification/notification.service';
import { UserService } from '@services/user/user.service';
import { parseListingFilters } from '@domain/listing/listing-filters';
import { Pagination, PaginationParams } from '@shared/pagination.helper';
import { Cookies } from '@shared/cookie.helper';

class SavedSearchDto {
  @IsString()
  @Length(1, 80)
  name: string;

  // Same keys/format as GET /listings query params; validated by parseListingFilters.
  @IsObject()
  filters: Record<string, string>;
}

@Controller()
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly userService: UserService,
  ) {}

  @Get('/notifications')
  async list(
    @Cookies('token') token: string,
    @PaginationParams() p: Pagination,
  ) {
    const me = await this.userService.getMe(token, []);
    const take = Math.min(p.limit || 20, 50);
    return this.notificationService.list(me, take, ((p.page || 1) - 1) * take);
  }

  @Get('/notifications/unread-count')
  async unreadCount(@Cookies('token') token: string) {
    return this.notificationService.unreadCount(
      await this.userService.getMe(token, []),
    );
  }

  @Post('/notifications/read-all')
  async readAll(@Cookies('token') token: string) {
    return this.notificationService.markRead(
      await this.userService.getMe(token, []),
    );
  }

  @Post('/notifications/:id/read')
  async read(@Param('id') id: string, @Cookies('token') token: string) {
    return this.notificationService.markRead(
      await this.userService.getMe(token, []),
      id,
    );
  }

  @Get('/saved-searches')
  async savedSearches(@Cookies('token') token: string) {
    return this.notificationService.getSavedSearches(
      await this.userService.getMe(token, []),
    );
  }

  @Post('/saved-searches')
  async createSavedSearch(
    @Body() body: SavedSearchDto,
    @Cookies('token') token: string,
  ) {
    const me = await this.userService.getMe(token, []);
    return this.notificationService.createSavedSearch(
      me,
      body.name,
      parseListingFilters(body.filters),
    );
  }

  @Delete('/saved-searches/:id')
  async deleteSavedSearch(
    @Param('id') id: string,
    @Cookies('token') token: string,
  ) {
    return this.notificationService.deleteSavedSearch(
      await this.userService.getMe(token, []),
      id,
    );
  }
}
