import { Body, Injectable, Param, Req, Headers } from '@nestjs/common';
import { Request } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AppDataSource } from '@/config/data-source';
import { Listing } from '@/domain/listing/Listing.entity';
import { UserService } from '../user/user.service';
import { CreateListingDto } from '@/application/dto/listing/create-listing.dto';
import { UpdateListingDto } from '@/application/dto/listing/update-listing.dto';
import { User } from '@/domain/user/User.entity';
import * as jwt from 'jsonwebtoken';
import { JwtPayload } from 'jsonwebtoken';

@Injectable()
export class ListingService {
  constructor(private readonly userService: UserService) {}

  async createListing(@Body() body: CreateListingDto, @Req() req: Request) {
    const { title, description, images, address, phone_number, email } = body;

    const user = await this.userService.getMyUser(req);

    if (!user) {
      return { message: 'User not found' };
    }

    if (!phone_number && !email) {
      return { message: 'Phone number or email is required' };
    }

    const listingRepository = AppDataSource.getRepository(Listing);
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

    const userRepository = AppDataSource.getRepository(User);

    if (!user.listings) {
      await userRepository.save({
        ...user,
        listings: [listing],
        updated_at: new Date(),
      });
    } else {
      await userRepository.save({
        ...user,
        listings: [...user.listings, listing],
        updated_at: new Date(),
      });
    }

    await listingRepository.save(listing);

    return { listing };
  }

  async updateListing(@Param('id') id: string, @Body() body: UpdateListingDto) {
    if (!id) {
      return { message: 'Listing id is required' };
    }
    const listingRepository = AppDataSource.getRepository(Listing);
    const listing = await listingRepository.findOne({ where: { id } });

    if (!listing) {
      return { message: 'Listing not found' };
    }

    const updatedListing = await listingRepository.save({
      ...listing,
      ...body,
      updated_at: new Date(),
    });

    return { listing: updatedListing };
  }

  async deleteListing(@Param('id') id: string) {
    if (!id) {
      return { message: 'Listing id is required' };
    }
    const listingRepository = AppDataSource.getRepository(Listing);
    const listing = await listingRepository.findOne({ where: { id } });

    if (!listing) {
      return { message: 'Listing not found' };
    }

    await listingRepository.delete(listing);
    return { message: 'Listing deleted' };
  }

  async getMyListings(@Headers() headers: { authorization: string }) {
    const token = headers.authorization.split(' ')[1];

    if (!token) return;

    const decode = jwt.decode(token);

    if (!decode) return;

    const userRepository = AppDataSource.getRepository(User);

    const user = await userRepository.findOne({
      where: { id: (decode as JwtPayload).id },
    });

    const listingRepository = AppDataSource.getRepository(Listing);

    const listings = await listingRepository.find({
      where: { user: user },
    });

    return { listings };
  }
}
