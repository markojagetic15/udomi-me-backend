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

  @Get('/listings')
  getMyListing(@Headers() headers: { authorization: string }) {
    return this.listingService.getMyListings(headers);
  }
}
