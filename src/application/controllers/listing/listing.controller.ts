import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Headers,
} from '@nestjs/common';
import { ListingService } from '@/services/listing/listing.service';
import { UpdateListingDto } from '@/application/dto/listing/update-listing.dto';
import { CreateListingDto } from '@/application/dto/listing/create-listing.dto';
import { Pagination, PaginationParams } from '@/shared/pagination.helper';

@Controller('/listings')
export class ListingController {
  constructor(private readonly listingService: ListingService) {}

  @Post('/')
  createListing(
    @Body() body: CreateListingDto,
    @Headers() headers: { authorization: string },
  ) {
    return this.listingService.createListing(body, headers);
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
    @Headers() headers: { authorization: string },
    @PaginationParams() paginationParams: Pagination,
  ) {
    return this.listingService.getMyListings(headers, paginationParams);
  }

  @Get('/')
  getAllListings(@PaginationParams() paginationParams: Pagination) {
    return this.listingService.getAllListings(paginationParams);
  }

  @Get('/:id')
  getListing(@Param('id') id: string) {
    return this.listingService.getListingById(id);
  }
}
