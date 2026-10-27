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
import { Throttle } from '@nestjs/throttler';
import { ListingService } from '@services/listing/listing.service';
import { ReportService } from '@services/report/report.service';
import { UpdateListingDto } from '@application/dto/listing/update-listing.dto';
import { CreateListingDto } from '@application/dto/listing/create-listing.dto';
import {
  AdoptListingDto,
  ReportListingDto,
} from '@application/dto/listing/listing-actions.dto';
import { Pagination, PaginationParams } from '@shared/pagination.helper';
import { Cookies } from '@shared/cookie.helper';

@Controller('/listings')
export class ListingController {
  constructor(
    private readonly listingService: ListingService,
    private readonly reportService: ReportService,
  ) {}

  @Post('/')
  @Throttle({ default: { limit: 20, ttl: 60 * 60_000 } })
  createListing(
    @Body() body: CreateListingDto,
    @Cookies('token') token: string,
  ) {
    return this.listingService.createListing(body, token);
  }

  @Put('/:id')
  updateListing(
    @Param('id') id: string,
    @Body() body: UpdateListingDto,
    @Cookies('token') token: string,
  ) {
    return this.listingService.updateListing(id, body, token);
  }

  @Delete('/:id')
  deleteListing(@Param('id') id: string, @Cookies('token') token: string) {
    return this.listingService.deleteListing(id, token);
  }

  @Post('/:id/activate')
  activate(@Param('id') id: string, @Cookies('token') token: string) {
    return this.listingService.setActive(id, true, token);
  }

  @Post('/:id/deactivate')
  deactivate(@Param('id') id: string, @Cookies('token') token: string) {
    return this.listingService.setActive(id, false, token);
  }

  @Post('/:id/favorite')
  favoriteListing(@Param('id') id: string, @Cookies('token') token: string) {
    return this.listingService.favoriteListing(id, token);
  }

  @Post('/:id/interest')
  showInterest(@Param('id') id: string, @Cookies('token') token: string) {
    return this.listingService.showInterest(id, token);
  }

  @Post('/:id/adopt')
  markAsAdopted(
    @Param('id') id: string,
    @Body() body: AdoptListingDto,
    @Cookies('token') token: string,
  ) {
    return this.listingService.markAsAdopted(id, token, body.adoption_story);
  }

  @Put('/:id/story')
  updateStory(
    @Param('id') id: string,
    @Body() body: AdoptListingDto,
    @Cookies('token') token: string,
  ) {
    return this.listingService.updateAdoptionStory(
      id,
      token,
      body.adoption_story,
    );
  }

  @Post('/:id/report')
  @Throttle({ default: { limit: 10, ttl: 60 * 60_000 } })
  reportListing(
    @Param('id') id: string,
    @Body() body: ReportListingDto,
    @Cookies('token') token: string,
  ) {
    return this.reportService.reportListing(id, body, token);
  }

  @Get('/user')
  getMyListing(
    @Cookies('token') token: string,
    @PaginationParams() paginationParams: Pagination,
    @Query() query: { search?: string },
  ) {
    return this.listingService.getMyListings(token, paginationParams, query);
  }

  @Get('/adopted')
  getAdopted(@PaginationParams() paginationParams: Pagination) {
    return this.listingService.getAdoptedListings(paginationParams);
  }

  @Get('/')
  getAllListings(
    @PaginationParams() paginationParams: Pagination,
    @Query() query: Record<string, string>,
  ) {
    return this.listingService.getAllListings(paginationParams, query);
  }

  @Get('/:id')
  getListing(@Param('id') id: string, @Cookies('token') token: string) {
    return this.listingService.getListingById(id, token);
  }
}
