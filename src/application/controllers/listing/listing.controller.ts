import { Request } from 'express';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  Headers,
} from '@nestjs/common';
import { ListingService } from '@/services/listing/listing.service';
import { UpdateListingDto } from '@/application/dto/listing/update-listing.dto';
import { CreateListingDto } from '@/application/dto/listing/create-listing.dto';
import { Pagination, PaginationParams } from '@/shared/pagination.helper';

@Controller('/api')
export class ListingController {
  constructor(private readonly listingService: ListingService) {}

  @Post('/listings')
  createListing(@Body() body: CreateListingDto, @Req() req: Request) {
    return this.listingService.createListing(body, req);
  }

  @Put('/listings/:id')
  updateListing(@Param('id') id: string, @Body() body: UpdateListingDto) {
    return this.listingService.updateListing(id, body);
  }

  @Delete('/listings/:id')
  deleteListing(@Param('id') id: string) {
    return this.listingService.deleteListing(id);
  }

  @Get('/user/listings')
  getMyListing(
    @Headers() headers: { authorization: string },
    @PaginationParams() paginationParams: Pagination,
  ) {
    return this.listingService.getMyListings(headers, paginationParams);
  }

  @Get('/listings')
  getAllListings(@PaginationParams() paginationParams: Pagination) {
    return this.listingService.getAllListings(paginationParams);
  }

  @Get('/listings/:id')
  getListing(@Param('id') id: string) {
    return this.listingService.getListingById(id);
  }
}
