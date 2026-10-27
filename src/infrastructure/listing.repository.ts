import { AppDataSource } from '@config/data-source';
import { Injectable } from '@nestjs/common';
import { Listing } from '@domain/listing/Listing.entity';
import { FindOptionsWhere, SelectQueryBuilder, UpdateResult } from 'typeorm';
import { ListingFilters, ListingSort } from '@domain/listing/listing-filters';
import { dbCall, likeEscape } from '@shared/db-call';

// date_of_birth is a varchar holding an ISO date; CASE guards the cast so a
// malformed legacy value yields NULL instead of failing the whole query.
const DOB = `(CASE WHEN l.date_of_birth ~ '^\\d{4}-\\d{2}-\\d{2}' THEN l.date_of_birth::timestamptz END)`;
const DISTANCE = `(6371 * acos(LEAST(1, cos(radians(:lat)) * cos(radians(l.lat)) * cos(radians(l.lng) - radians(:lng)) + sin(radians(:lat)) * sin(radians(l.lat)))))`;

const monthsAgo = (months: number) => {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d;
};

@Injectable()
export class ListingRepository {
  private readonly listingRepository = AppDataSource.getRepository(Listing);

  findById(id: string, relations?: string[]): Promise<Listing | null> {
    return dbCall('finding listing', () =>
      this.listingRepository.findOne({ where: { id }, relations }),
    );
  }

  save(listing: Listing): Promise<Listing> {
    return dbCall('saving listing', () => this.listingRepository.save(listing));
  }

  update(id: string, listing: Partial<Listing>): Promise<UpdateResult> {
    return dbCall('updating listing', () =>
      this.listingRepository.update({ id }, listing),
    );
  }

  async remove(listing: Listing): Promise<void> {
    await dbCall('removing listing', () =>
      this.listingRepository.remove(listing),
    );
  }

  findAndCount(options: {
    where?: FindOptionsWhere<Listing> | FindOptionsWhere<Listing>[];
    take?: number;
    skip?: number;
    order?: Record<string, 'ASC' | 'DESC'>;
    relations?: string[];
  }): Promise<[Listing[], number]> {
    return dbCall('finding listings', () =>
      this.listingRepository.findAndCount(options),
    );
  }

  count(where: FindOptionsWhere<Listing> = {}): Promise<number> {
    return dbCall('counting listings', () =>
      this.listingRepository.count({ where }),
    );
  }

  // Everything publicly browsable: not hidden by an admin, not closed by the
  // owner, not adopted/reunited, owner not banned.
  private visible(): SelectQueryBuilder<Listing> {
    return this.listingRepository
      .createQueryBuilder('l')
      .leftJoinAndSelect('l.user', 'u')
      .where('l.is_hidden = false')
      .andWhere('COALESCE(l.is_active, true) = true')
      .andWhere('COALESCE(l.is_adopted, false) = false')
      .andWhere('u.is_banned = false');
  }

  // SQL form of matchesFilters() in listing-filters.ts — keep them in sync.
  search(
    f: ListingFilters,
    sort: ListingSort,
    take: number,
    skip: number,
    ownerId?: string,
  ): Promise<[Listing[], number]> {
    const qb = this.visible();

    if (ownerId) qb.andWhere('u.id = :ownerId', { ownerId });
    else qb.andWhere('l.listing_type = :type', { type: f.type ?? 'adoption' });

    if (f.search) {
      qb.andWhere(
        '(l.title ILIKE :q OR l.breed ILIKE :q OR l.description ILIKE :q)',
        {
          q: `%${likeEscape(f.search)}%`,
        },
      );
    }
    if (f.categories?.length)
      qb.andWhere('l.category IN (:...cats)', { cats: f.categories });
    if (f.gender) qb.andWhere('l.gender = :gender', { gender: f.gender });
    if (f.size_min !== undefined)
      qb.andWhere('COALESCE(l.size, 0) >= :smin', { smin: f.size_min });
    if (f.size_max !== undefined)
      qb.andWhere('COALESCE(l.size, 0) <= :smax', { smax: f.size_max });
    if (f.age_min !== undefined)
      qb.andWhere(`${DOB} <= :dobMax`, { dobMax: monthsAgo(f.age_min) });
    if (f.age_max !== undefined)
      qb.andWhere(`${DOB} > :dobMin`, { dobMin: monthsAgo(f.age_max + 1) });
    if (f.city) {
      qb.andWhere('(l.city ILIKE :city OR l.address ILIKE :city)', {
        city: `%${likeEscape(f.city)}%`,
      });
    }
    const hasPoint = f.lat !== undefined && f.lng !== undefined;
    if (hasPoint) qb.setParameters({ lat: f.lat, lng: f.lng });
    if (hasPoint && f.radius_km) {
      qb.andWhere('l.lat IS NOT NULL AND l.lng IS NOT NULL');
      qb.andWhere(`${DISTANCE} <= :radius`, { radius: f.radius_km });
    }
    if (f.vaccinated) qb.andWhere('l.is_vaccinated = true');
    if (f.sterilized) qb.andWhere('l.is_sterilized = true');
    if (f.good_with_kids) qb.andWhere('l.good_with_kids = true');
    if (f.good_with_dogs) qb.andWhere('l.good_with_dogs = true');
    if (f.good_with_cats) qb.andWhere('l.good_with_cats = true');
    if (f.urgent) qb.andWhere('l.is_urgent = true');
    if (f.shelter_only) qb.andWhere(`u.shelter_status = 'verified'`);
    if (f.free_only)
      qb.andWhere('(l.adoption_fee IS NULL OR l.adoption_fee = 0)');

    if (sort === 'nearest' && hasPoint) {
      qb.orderBy(`${DISTANCE}`, 'ASC', 'NULLS LAST');
    } else if (sort === 'urgent') {
      qb.orderBy('l.is_urgent', 'DESC', 'NULLS LAST');
    }
    qb.addOrderBy('l.created_at', sort === 'oldest' ? 'ASC' : 'DESC');

    // offset/limit (not skip/take): the only join is many-to-one, so rows
    // aren't multiplied, and skip/take's DISTINCT wrapper can't order by an
    // expression like DISTANCE.
    return dbCall('searching listings', () =>
      qb.offset(skip).limit(take).getManyAndCount(),
    );
  }

  // Admin list: every listing in any state, with its open report count.
  async adminSearch(
    query: string,
    status: string,
    type: string,
    take: number,
    skip: number,
  ): Promise<[{ listing: Listing; openReports: number }[], number]> {
    const OPEN = `(SELECT COUNT(*) FROM reports r WHERE r."listingId" = l.id AND r.status = 'open')`;
    const qb = this.listingRepository
      .createQueryBuilder('l')
      .leftJoinAndSelect('l.user', 'u');
    const q = likeEscape(query.trim());
    if (q) {
      qb.andWhere(
        '(l.title ILIKE :q OR l.description ILIKE :q OR u.email ILIKE :q OR l.city ILIKE :q)',
        {
          q: `%${q}%`,
        },
      );
    }
    if (['adoption', 'lost', 'found'].includes(type))
      qb.andWhere('l.listing_type = :type', { type });
    const live =
      'l.is_hidden = false AND COALESCE(l.is_adopted, false) = false';
    if (status === 'active')
      qb.andWhere(`${live} AND COALESCE(l.is_active, true) = true`);
    if (status === 'paused') qb.andWhere(`${live} AND l.is_active = false`);
    if (status === 'adopted') qb.andWhere('l.is_adopted = true');
    if (status === 'hidden') qb.andWhere('l.is_hidden = true');
    if (status === 'reported') qb.andWhere(`${OPEN} > 0`);

    const total = await dbCall('counting listings', () => qb.getCount());
    qb.addSelect(OPEN, 'open_reports')
      .orderBy('l.created_at', 'DESC')
      .offset(skip)
      .limit(take);
    const { entities, raw } = await dbCall('searching listings', () =>
      qb.getRawAndEntities(),
    );
    const byId = new Map(raw.map((r: Record<string, string>) => [r.l_id, r]));
    return [
      entities.map((listing) => ({
        listing,
        openReports: Number(byId.get(listing.id)?.open_reports ?? 0),
      })),
      total,
    ];
  }

  // Success stories: adopted (or reunited) listings, newest first.
  findAdopted(take: number, skip: number): Promise<[Listing[], number]> {
    return dbCall('finding adopted listings', () =>
      this.listingRepository
        .createQueryBuilder('l')
        .leftJoinAndSelect('l.user', 'u')
        .where('l.is_adopted = true')
        .andWhere('l.is_hidden = false')
        .andWhere('u.is_banned = false')
        .orderBy('l.adopted_at', 'DESC', 'NULLS LAST')
        .addOrderBy('l.updated_at', 'DESC')
        .offset(skip)
        .limit(take)
        .getManyAndCount(),
    );
  }

  // Owner's own listings, including inactive/adopted/hidden ones.
  findByOwner(ownerId: string, take: number, skip: number, search?: string) {
    const qb = this.listingRepository
      .createQueryBuilder('l')
      .leftJoin('l.user', 'u')
      .where('u.id = :ownerId', { ownerId });
    if (search)
      qb.andWhere('l.title ILIKE :q', { q: `%${likeEscape(search)}%` });
    return dbCall('finding listings', () =>
      qb
        .orderBy('l.created_at', 'DESC')
        .offset(skip)
        .limit(take)
        .getManyAndCount(),
    );
  }

  findImagesByOwner(ownerId: string): Promise<Listing[]> {
    return dbCall('finding listings', () =>
      this.listingRepository
        .createQueryBuilder('l')
        .leftJoin('l.user', 'u')
        .select(['l.id', 'l.images'])
        .where('u.id = :ownerId', { ownerId })
        .getMany(),
    );
  }
}
