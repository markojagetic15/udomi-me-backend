import { AppDataSource } from '@/config/data-source';
import { Injectable } from '@nestjs/common';
import { Listing } from '@/domain/listing/Listing.entity';
import { UpdateResult } from 'typeorm';
import { UpdateListingDto } from '@/application/dto/listing/update-listing.dto';

@Injectable()
export class ListingRepository {
  private readonly listingRepository = AppDataSource.getRepository(Listing);

  async findById(id: string, relations?: string[]): Promise<Listing | null> {
    return this.listingRepository.findOne({
      where: { id },
      relations: relations,
    });
  }

  async save(listing: Listing): Promise<Listing> {
    return this.listingRepository.save(listing);
  }

  async update(id: string, listing: UpdateListingDto): Promise<UpdateResult> {
    return this.listingRepository.update(
      { id },
      { ...listing, updated_at: new Date() },
    );
  }

  async remove(listing: Listing): Promise<void> {
    await this.listingRepository.remove(listing);
  }
}
