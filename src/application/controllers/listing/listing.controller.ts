import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ListingService } from '@services/listing/listing.service';
import { UpdateListingDto } from '@application/dto/listing/update-listing.dto';
import { CreateListingDto } from '@application/dto/listing/create-listing.dto';
import { Pagination, PaginationParams } from '@shared/pagination.helper';
import { Cookies } from '@shared/cookie.helper';

@Controller('/listings')
export class ListingController {
  constructor(private readonly listingService: ListingService) {}

  @Post('/')
  createListing(
    @Body() body: CreateListingDto,
    @Cookies('token') token: string,
  ) {
    return this.listingService.createListing(body, token);
  }

  @Put('/:id')
  updateListing(@Param('id') id: string, @Body() body: UpdateListingDto) {
    return this.listingService.updateListing(id, body);
  }

  @Delete('/:id')
  deleteListing(@Param('id') id: string) {
    return this.listingService.deleteListing(id);
  }

  @Get('/user')
  getMyListing(
    @Cookies('token') token: string,
    @PaginationParams() paginationParams: Pagination,
    @Query() query: { search: string },
  ) {
    return this.listingService.getMyListings(token, paginationParams, query);
  }

  @Get('/')
  getAllListings(
    @PaginationParams() paginationParams: Pagination,
    @Query()
    query: { search: string; category: string; order: 'ASC' | 'DESC' },
  ) {
    return this.listingService.getAllListings(paginationParams, query);
  }

  @Get('/:id')
  getListing(@Param('id') id: string) {
    return this.listingService.getListingById(id);
  }
}
