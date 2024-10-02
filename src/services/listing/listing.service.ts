import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { AppDataSource } from '@/config/data-source';
import { Listing } from '@/domain/listing/Listing.entity';
import { UserService } from '../user/user.service';
import { CreateListingDto } from '@/application/dto/listing/create-listing.dto';
import { UpdateListingDto } from '@/application/dto/listing/update-listing.dto';
import { User } from '@/domain/user/User.entity';
import * as jwt from 'jsonwebtoken';
import { JwtPayload } from 'jsonwebtoken';
import { Pagination } from '@/shared/pagination.helper';
import { ListingResponseDto } from '@/application/dto/listing/listing-response.dto';
import { plainToClass } from 'class-transformer';
import { ListingRepository } from '@/infrastructure/listing.repository';
import { UserRepository } from '@/infrastructure/user.repository';

@Injectable()
export class ListingService {
  constructor(
    private readonly userService: UserService,
    private readonly listingRepository: ListingRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async createListing(
    body: CreateListingDto,
    headers: { authorization: string },
  ) {
    const { title, description, images, address, phone_number, email } = body;

    const { user } = await this.userService.getMe(headers);

    if (!user) {
      throw new Error('User not found');
    }

    if (!phone_number && !email) {
      throw new Error('Phone number or email is required');
    }

    const listing = new Listing();

    listing.title = title;
    listing.description = description;
    listing.images = images || [];
    listing.address = address;
    listing.phone_number = phone_number;
    listing.email = email;
    listing.user = user;
    listing.id = uuidv4();
    listing.created_at = new Date();
    listing.updated_at = new Date();

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
      return { message: 'Listing not found' };
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
      return { message: 'Listing not found' };
    }

    await this.listingRepository.remove(listing);

    return { message: 'Listing deleted' };
  }

  async getMyListings(
    headers: { authorization: string },
    paginationParams: Pagination,
  ) {
    const take = paginationParams.limit || 10;
    const page = paginationParams.page || 1;
    const skip = (page - 1) * take;

    const token = headers.authorization.split(' ')[1];

    if (!token) return;

    const decode = jwt.decode(token);

    if (!decode) return;

    const userRepository = AppDataSource.getRepository(User);

    const user = await userRepository.findOne({
      where: { id: (decode as JwtPayload).id },
    });

    const listingRepository = AppDataSource.getRepository(Listing);

    const [listings, total] = await listingRepository.findAndCount({
      where: { user: user },
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

  async getAllListings(paginationParams: Pagination) {
    const take = paginationParams.limit || 10;
    const page = paginationParams.page || 1;
    const skip = (page - 1) * take;

    const listingRepository = AppDataSource.getRepository(Listing);
    const [listings, total] = await listingRepository.findAndCount({
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

  async getListingById(id: string) {
    const listing = await this.listingRepository.findById(id);

    if (!listing) {
      return { message: 'Listing not found' };
    }

    return { listing };
  }
}
