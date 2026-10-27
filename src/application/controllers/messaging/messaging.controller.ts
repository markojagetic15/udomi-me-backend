import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { MessagingService } from '@services/messaging/messaging.service';
import {
  SendMessageDto,
  StartConversationDto,
} from '@application/dto/messaging/messaging.dto';
import { Pagination, PaginationParams } from '@shared/pagination.helper';
import { Cookies } from '@shared/cookie.helper';

@Controller('/conversations')
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  @Get('/')
  list(
    @Cookies('token') token: string,
    @PaginationParams() pagination: Pagination,
  ) {
    return this.messagingService.list(token, pagination);
  }

  @Get('/unread-count')
  unreadCount(@Cookies('token') token: string) {
    return this.messagingService.unreadCount(token);
  }

  @Post('/')
  @Throttle({ default: { limit: 20, ttl: 60 * 60_000 } })
  start(@Body() body: StartConversationDto, @Cookies('token') token: string) {
    return this.messagingService.start(token, body.listing_id, body.body);
  }

  @Get('/:id')
  get(@Param('id') id: string, @Cookies('token') token: string) {
    return this.messagingService.get(token, id);
  }

  @Get('/:id/messages')
  messages(
    @Param('id') id: string,
    @Query('after') after: string | undefined,
    @Cookies('token') token: string,
  ) {
    return this.messagingService.messages(token, id, after);
  }

  @Post('/:id/messages')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  send(
    @Param('id') id: string,
    @Body() body: SendMessageDto,
    @Cookies('token') token: string,
  ) {
    return this.messagingService.send(token, id, body.body);
  }
}
