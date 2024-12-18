import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { Listing } from '@domain/listing/Listing.entity';
import { UserService } from '../user/user.service';
import { CreateListingDto } from '@application/dto/listing/create-listing.dto';
import { UpdateListingDto } from '@application/dto/listing/update-listing.dto';
import { Pagination } from '@shared/pagination.helper';
import { ListingResponseDto } from '@application/dto/listing/listing-response.dto';
import { plainToClass } from 'class-transformer';
import { ListingRepository } from '@infrastructure/listing.repository';
import { UserRepository } from '@infrastructure/user.repository';
import { Category } from '@domain/listing/Category.enum';
import { Like } from 'typeorm';

@Injectable()
export class ListingService {
  constructor(
    private readonly userService: UserService,
    private readonly listingRepository: ListingRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async createListing(body: CreateListingDto, token: string) {
    const { phone_number, email } = body;

    const { user } = await this.userService.getMe(token);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!phone_number && !email) {
      throw new HttpException(
        'Phone number or email is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    const listing = new Listing();

    Object.assign(listing, body);

    listing.id = uuidv4();
    listing.category = body.category || Category.OTHER;
    listing.user = user;
    listing.interested_users = [];
    listing.is_active = true;
    listing.is_adopted = false;

    if (!user.listings) {
      user.listings = [listing];
    } else {
      user.listings.push(listing);
    }

    await this.userRepository.save(user);

    await this.listingRepository.save(listing);

    const responseDto = plainToClass(ListingResponseDto, listing);

    return {
      listing: responseDto,
    };
  }

  async updateListing(id: string, body: UpdateListingDto) {
    const listing = await this.listingRepository.findById(id);

    if (!listing) {
      return new NotFoundException('Listing not found');
    }

    const updatedListing = await this.listingRepository.update(listing.id, {
      ...body,
    });

    const responseDto = plainToClass(ListingResponseDto, updatedListing);

    return { listing: responseDto };
  }

  async deleteListing(id: string) {
    const listing = await this.listingRepository.findById(id);

    if (!listing) {
      return new NotFoundException('Listing not found');
    }

    await this.listingRepository.remove(listing);

    return new HttpException('Listing deleted', HttpStatus.OK);
  }

  async getMyListings(
    token: string,
    paginationParams: Pagination,
    query: { search: string },
  ) {
    const take = paginationParams.limit || 10;
    const page = paginationParams.page || 1;
    const skip = (page - 1) * take;
    const searchCondition = query.search
      ? { title: Like(`%${query.search}%`) }
      : {};

    const { user } = await this.userService.getMe(token);

    const [listings, total] = await this.listingRepository.findAndCount({
      where: {
        user: { id: user.id },
        ...searchCondition,
      },
      take: paginationParams.limit,
      skip,
    });

    return {
      listings,
      meta: {
        total,
        page,
        take,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  async getAllListings(
    paginationParams: Pagination,
    query: { search: string; category: string; order: 'ASC' | 'DESC' },
  ) {
    const { category, order, search } = query;
    const take = paginationParams.limit || 10;
    const page = paginationParams.page || 1;
    const skip = (page - 1) * take;
    const searchCondition = search
      ? { title: Like(`%${search.toLowerCase()}%`) }
      : {};
    const isActive = { is_active: true };
    const isAdopted = { is_adopted: false };
    const categories = category ? (JSON.parse(category) as Category[]) : [];

    const [listings, total] = await this.listingRepository.findAndCount({
      take: paginationParams.limit,
      skip,
      where: category
        ? categories.map((cat) => ({
            category: cat,
            ...searchCondition,
            ...isActive,
            ...isAdopted,
          }))
        : { ...searchCondition, ...isActive, ...isAdopted },
      order: order ? { created_at: order } : { created_at: 'DESC' },
    });

    return {
      listings,
      meta: {
        total,
        page,
        take,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  async getListingById(id: string) {
    const listing = await this.listingRepository.findById(id, ['user']);

    if (!listing) {
      return new NotFoundException('Listing not found');
    }

    return { listing };
  }

  async favoriteListing(id: string, token: string) {
    const { user } = await this.userService.getMe(token);

    const listing = await this.listingRepository.findById(id);

    if (!listing) {
      return new NotFoundException('Listing not found');
    }

    if (!user.favorite_listings) {
      user.favorite_listings = [listing];
    } else {
      user.favorite_listings.push(listing);
    }

    const updateListing = {
      ...listing,
      number_of_interested_users: listing.number_of_interested_users + 1,
    };

    await this.userRepository.save(user);
    await this.listingRepository.save(updateListing);

    return { message: 'Listing favorited' };
  }

  async reportListing(id: string, token: string) {
    const { user } = await this.userService.getMe(token);

    const listing = await this.listingRepository.findById(id);

    if (!listing) {
      return new NotFoundException('Listing not found');
    }

    // TODO: Implement reporting logic

    return { message: 'Listing reported' };
  }
}
