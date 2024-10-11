import { AppDataSource } from '@config/data-source';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Listing } from '@domain/listing/Listing.entity';
import { UpdateResult } from 'typeorm';
import { UpdateListingDto } from '@application/dto/listing/update-listing.dto';

@Injectable()
export class ListingRepository {
  private readonly listingRepository = AppDataSource.getRepository(Listing);

  async findById(id: string, relations?: string[]): Promise<Listing | null> {
    try {
      return this.listingRepository.findOne({
        where: { id },
        relations: relations,
      });
    } catch (e) {
      console.error(e);
      throw new HttpException(
        'Error finding listing',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async save(listing: Listing): Promise<Listing> {
    try {
      return this.listingRepository.save(listing);
    } catch (e) {
      console.error(e);
      throw new HttpException(
        'Error saving listing',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async update(id: string, listing: UpdateListingDto): Promise<UpdateResult> {
    try {
      return this.listingRepository.update({ id }, { ...listing });
    } catch (e) {
      console.error(e);
      throw new HttpException(
        'Error updating listing',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async remove(listing: Listing): Promise<void> {
    try {
      await this.listingRepository.remove(listing);
    } catch (e) {
      console.error(e);
      throw new HttpException(
        'Error removing listing',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findAndCount(options: {
    where?: Record<string, any>;
    take?: number;
    skip?: number;
    order?: Record<string, 'ASC' | 'DESC'>;
  }): Promise<[Listing[], number]> {
    try {
      return this.listingRepository.findAndCount(options);
    } catch (e) {
      console.error(e);
      throw new HttpException(
        'Error finding listings',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
