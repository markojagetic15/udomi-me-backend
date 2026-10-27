import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { Listing } from '@domain/listing/Listing.entity';
import { User } from '@domain/user/User.entity';
import { publicUser, displayName } from '@domain/user/public-user';
import {
  parseListingFilters,
  parseListingSort,
} from '@domain/listing/listing-filters';
import { UserService, deleteUploadedFiles } from '../user/user.service';
import { NotificationService } from '../notification/notification.service';
import { CreateListingDto } from '@application/dto/listing/create-listing.dto';
import { UpdateListingDto } from '@application/dto/listing/update-listing.dto';
import { Pagination } from '@shared/pagination.helper';
import { ListingRepository } from '@infrastructure/listing.repository';
import { UserRepository } from '@infrastructure/user.repository';

type Query = Record<string, string | string[] | undefined>;

const pageOf = (p: Pagination, max = 48) => {
  const take = Math.min(Math.max(p.limit || 12, 1), max);
  const page = Math.max(p.page || 1, 1);
  return { take, page, skip: (page - 1) * take };
};

const withPublicOwner = (l: Listing) => ({ ...l, user: publicUser(l.user) });

@Injectable()
export class ListingService {
  constructor(
    private readonly userService: UserService,
    private readonly notificationService: NotificationService,
    private readonly listingRepository: ListingRepository,
    private readonly userRepository: UserRepository,
  ) {}

  private validateByType(type: string, body: Partial<CreateListingDto>) {
    if (type === 'adoption' && body.date_of_birth === undefined) {
      throw new BadRequestException(
        'date_of_birth is required for adoption listings',
      );
    }
    if (type !== 'adoption' && !body.address && !body.city) {
      throw new BadRequestException(
        'A location is required for lost/found listings',
      );
    }
  }

  async createListing(body: CreateListingDto, token: string) {
    const user = await this.userService.requireVerified(token);
    const type = body.listing_type ?? 'adoption';
    this.validateByType(type, body);

    const listing = new Listing();
    Object.assign(listing, body);
    listing.id = uuidv4();
    listing.listing_type = type;
    listing.user = { id: user.id } as User;
    listing.is_active = true;
    listing.is_adopted = false;
    listing.is_hidden = false;
    listing.is_urgent = body.is_urgent ?? false;
    listing.event_date = body.event_date ? new Date(body.event_date) : null;
    listing.number_of_interested_users = 0;

    await this.listingRepository.save(listing);

    // Fire-and-forget: alerts shouldn't slow down or fail the publish.
    this.notificationService
      .notifySavedSearches(listing, user)
      .catch((e) => console.error('Saved search alerts failed:', e));

    return { listing: withPublicOwner({ ...listing, user } as Listing) };
  }

  private async ownListing(id: string, token: string) {
    const user = await this.userService.getMe(token, []);
    const listing = await this.listingRepository.findById(id, ['user']);
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.user?.id !== user.id) {
      throw new ForbiddenException('You can only change your own listings');
    }
    return { user, listing };
  }

  async updateListing(id: string, body: UpdateListingDto, token: string) {
    const { listing } = await this.ownListing(id, token);
    this.validateByType(listing.listing_type, {
      ...listing,
      ...body,
    } as Partial<CreateListingDto>);

    const removedImages = body.images
      ? (listing.images ?? []).filter(
          (old) => !body.images!.some((n) => n.id === old.id),
        )
      : [];

    const { event_date, ...rest } = body;
    await this.listingRepository.update(listing.id, {
      ...rest,
      ...(event_date !== undefined
        ? { event_date: event_date ? new Date(event_date) : null }
        : {}),
    });
    await deleteUploadedFiles(removedImages.map((i) => i.url));

    const updated = await this.listingRepository.findById(id, ['user']);
    return { listing: withPublicOwner(updated!) };
  }

  async deleteListing(id: string, token: string) {
    const { listing } = await this.ownListing(id, token);
    await this.listingRepository.remove(listing);
    await deleteUploadedFiles((listing.images ?? []).map((i) => i.url));
    return { message: 'Listing deleted' };
  }

  // Owner can pause/resume a listing without deleting it.
  async setActive(id: string, active: boolean, token: string) {
    const { listing } = await this.ownListing(id, token);
    listing.is_active = active;
    await this.listingRepository.save(listing);
    return { listing: withPublicOwner(listing) };
  }

  async markAsAdopted(id: string, token: string, story?: string) {
    const { listing } = await this.ownListing(id, token);
    listing.is_adopted = true;
    listing.adopted_at = new Date();
    listing.adoption_story = story?.trim() || null;
    await this.listingRepository.save(listing);
    return {
      message: 'Listing marked as adopted',
      listing: withPublicOwner(listing),
    };
  }

  async updateAdoptionStory(id: string, token: string, story?: string) {
    const { listing } = await this.ownListing(id, token);
    if (!listing.is_adopted)
      throw new BadRequestException('Listing is not adopted yet');
    listing.adoption_story = story?.trim() || null;
    await this.listingRepository.save(listing);
    return { listing: withPublicOwner(listing) };
  }

  async getMyListings(
    token: string,
    pagination: Pagination,
    query: { search?: string },
  ) {
    const me = await this.userService.getMe(token, []);
    const { take, page, skip } = pageOf(pagination);
    const [listings, total] = await this.listingRepository.findByOwner(
      me.id,
      take,
      skip,
      query.search,
    );
    return {
      listings,
      meta: { total, page, take, totalPages: Math.ceil(total / take) },
    };
  }

  async getAllListings(pagination: Pagination, query: Query) {
    const filters = parseListingFilters(query);
    const sort = parseListingSort(query);
    const { take, page, skip } = pageOf(pagination);
    const [listings, total] = await this.listingRepository.search(
      filters,
      sort,
      take,
      skip,
    );
    return {
      listings: listings.map(withPublicOwner),
      meta: { total, page, take, totalPages: Math.ceil(total / take) },
    };
  }

  async getAdoptedListings(pagination: Pagination) {
    const { take, page, skip } = pageOf(pagination);
    const [listings, total] = await this.listingRepository.findAdopted(
      take,
      skip,
    );
    return {
      listings: listings.map(withPublicOwner),
      meta: { total, page, take, totalPages: Math.ceil(total / take) },
    };
  }

  // Hidden/paused listings are only visible to their owner and admins.
  async getListingById(id: string, token?: string) {
    const listing = await this.listingRepository.findById(id, ['user']);
    if (!listing) throw new NotFoundException('Listing not found');

    const restricted =
      listing.is_hidden ||
      listing.is_active === false ||
      listing.user?.is_banned;
    if (restricted) {
      const me = await this.userService.getMeOptional(token);
      const allowed = me && (me.id === listing.user?.id || me.role === 'admin');
      if (!allowed) throw new NotFoundException('Listing not found');
    }
    return { listing: withPublicOwner(listing) };
  }

  async favoriteListing(id: string, token: string) {
    const user = await this.userService.getMe(token, ['favorite_listings']);
    const listing = await this.listingRepository.findById(id);
    if (!listing) throw new NotFoundException('Listing not found');

    const isFavorited = user.favorite_listings.some((l) => l.id === listing.id);
    user.favorite_listings = isFavorited
      ? user.favorite_listings.filter((l) => l.id !== listing.id)
      : [...user.favorite_listings, listing];
    await this.userRepository.save(user);

    return {
      message: isFavorited ? 'Listing unfavorited' : 'Listing favorited',
      isFavorited: !isFavorited,
    };
  }

  async showInterest(id: string, token: string) {
    const user = await this.userService.getMe(token, ['interested_listings']);
    const listing = await this.listingRepository.findById(id, ['user']);
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.user.id === user.id) {
      throw new ForbiddenException(
        'You cannot show interest in your own listing',
      );
    }

    const isInterested = user.interested_listings.some(
      (l) => l.id === listing.id,
    );
    if (isInterested) {
      user.interested_listings = user.interested_listings.filter(
        (l) => l.id !== listing.id,
      );
      listing.number_of_interested_users = Math.max(
        0,
        (listing.number_of_interested_users || 0) - 1,
      );
    } else {
      user.interested_listings.push(listing);
      listing.number_of_interested_users =
        (listing.number_of_interested_users || 0) + 1;
    }

    await this.userRepository.save(user);
    await this.listingRepository.update(listing.id, {
      number_of_interested_users: listing.number_of_interested_users,
    });

    if (!isInterested) {
      await this.notificationService.notify(listing.user, 'interest', {
        listing_id: listing.id,
        listing_title: listing.title,
        from_name: displayName(user),
        count: listing.number_of_interested_users,
      });
    }

    return {
      message: isInterested ? 'Interest removed' : 'Interest shown',
      isInterested: !isInterested,
      number_of_interested_users: listing.number_of_interested_users,
    };
  }
}
