import {
  ForbiddenException,
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
import { ListingRepository } from '@infrastructure/listing.repository';
import { UserRepository } from '@infrastructure/user.repository';
import { Category } from '@domain/listing/Category.enum';
import { ILike } from 'typeorm';

@Injectable()
export class ListingService {
  constructor(
    private readonly userService: UserService,
    private readonly listingRepository: ListingRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async createListing(body: CreateListingDto, token: string) {
    const user = await this.userService.getMe(token);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const listing = new Listing();
    Object.assign(listing, body);

    listing.id = uuidv4();
    listing.category = body.category || Category.OTHER;
    listing.user = user;
    listing.is_active = true;
    listing.is_adopted = false;
    listing.is_urgent = body.is_urgent ?? false;

    await this.listingRepository.save(listing);

    const userWithListings = await this.userRepository.findById(user.id, [
      'listings',
    ]);

    if (!userWithListings) {
      throw new NotFoundException('User not found after fetching relationships');
    }

    userWithListings.listings.push(listing);
    await this.userRepository.save(userWithListings);

    return { listing };
  }

  async updateListing(id: string, body: UpdateListingDto) {
    const listing = await this.listingRepository.findById(id);

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    await this.listingRepository.update(listing.id, { ...body });

    const updated = await this.listingRepository.findById(id);
    return { listing: updated };
  }

  async deleteListing(id: string, token: string) {
    const user = await this.userService.getMe(token);
    const listing = await this.listingRepository.findById(id, ['user']);

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    if (listing.user.id !== user.id) {
      throw new ForbiddenException('You can only delete your own listings');
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
      ? { title: ILike(`%${query.search}%`) }
      : {};

    const user = await this.userService.getMe(token);

    const [listings, total] = await this.listingRepository.findAndCount({
      where: {
        user: { id: user.id },
        ...searchCondition,
      },
      take,
      skip,
      order: { created_at: 'DESC' },
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
      ? { title: ILike(`%${search.toLowerCase().trim()}%`) }
      : {};
    const baseWhere = { is_active: true, is_adopted: false };
    const categories = category ? (JSON.parse(category) as Category[]) : [];

    const [listings, total] = await this.listingRepository.findAndCount({
      take,
      skip,
      where: category
        ? categories.map((cat) => ({
            category: cat,
            ...searchCondition,
            ...baseWhere,
          }))
        : { ...searchCondition, ...baseWhere },
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
      throw new NotFoundException('Listing not found');
    }

    return { listing };
  }

  async favoriteListing(id: string, token: string) {
    const user = await this.userService.getMe(token);
    const listing = await this.listingRepository.findById(id);

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    const userWithFavorites = await this.userRepository.findById(user.id, [
      'favorite_listings',
    ]);

    if (!userWithFavorites) {
      throw new NotFoundException('User not found');
    }

    const isFavorited = userWithFavorites.favorite_listings.some(
      (l) => l.id === listing.id,
    );

    if (isFavorited) {
      userWithFavorites.favorite_listings =
        userWithFavorites.favorite_listings.filter((l) => l.id !== listing.id);
    } else {
      userWithFavorites.favorite_listings.push(listing);
    }

    await this.userRepository.save(userWithFavorites);

    return {
      message: isFavorited ? 'Listing unfavorited' : 'Listing favorited',
    };
  }

  async showInterest(id: string, token: string) {
    const user = await this.userService.getMe(token);
    const listing = await this.listingRepository.findById(id, ['user']);

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    if (listing.user.id === user.id) {
      throw new ForbiddenException('You cannot show interest in your own listing');
    }

    const userWithInterested = await this.userRepository.findById(user.id, [
      'interested_listings',
    ]);

    if (!userWithInterested) {
      throw new NotFoundException('User not found');
    }

    const isInterested = userWithInterested.interested_listings.some(
      (l) => l.id === listing.id,
    );

    if (isInterested) {
      userWithInterested.interested_listings =
        userWithInterested.interested_listings.filter((l) => l.id !== listing.id);
      listing.number_of_interested_users = Math.max(
        0,
        (listing.number_of_interested_users || 0) - 1,
      );
    } else {
      userWithInterested.interested_listings.push(listing);
      listing.number_of_interested_users =
        (listing.number_of_interested_users || 0) + 1;
    }

    await this.userRepository.save(userWithInterested);
    await this.listingRepository.save(listing);

    return {
      message: isInterested ? 'Interest removed' : 'Interest shown',
      isInterested: !isInterested,
      number_of_interested_users: listing.number_of_interested_users,
    };
  }

  async markAsAdopted(id: string, token: string) {
    const user = await this.userService.getMe(token);
    const listing = await this.listingRepository.findById(id, ['user']);

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    if (listing.user.id !== user.id) {
      throw new ForbiddenException('You can only mark your own listings as adopted');
    }

    listing.is_adopted = true;
    listing.is_active = false;

    await this.listingRepository.save(listing);

    return { message: 'Listing marked as adopted', listing };
  }

  async reportListing(id: string, token: string) {
    const listing = await this.listingRepository.findById(id);

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    return { message: 'Listing reported' };
  }
}
