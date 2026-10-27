import { User } from '@domain/user/User.entity';
import { Listing } from '@domain/listing/Listing.entity';
import { AppDataSource } from '@config/data-source';
import { Injectable } from '@nestjs/common';
import { ILike, In, Raw } from 'typeorm';
import { dbCall, likeEscape } from '@shared/db-call';

// Exact, case-insensitive email match (not ILIKE — '_' and '%' are wildcards there).
const emailEquals = (email: string) =>
  Raw((alias) => `LOWER(${alias}) = LOWER(:email)`, { email: email.trim() });

@Injectable()
export class UserRepository {
  private readonly userRepository = AppDataSource.getRepository(User);

  findById(id: string, relations?: string[]): Promise<User | null> {
    return dbCall('finding user', () =>
      this.userRepository.findOne({ where: { id }, relations }),
    );
  }

  findByIds(ids: string[]): Promise<User[]> {
    if (!ids.length) return Promise.resolve([]);
    return dbCall('finding users', () =>
      this.userRepository.find({ where: { id: In(ids) } }),
    );
  }

  findByEmail(email: string): Promise<User | null> {
    // Case-insensitive: "Ana@x.com" and "ana@x.com" are the same account.
    return dbCall('finding user', () =>
      this.userRepository.findOne({ where: { email: emailEquals(email) } }),
    );
  }

  async findByVerificationToken(token: string): Promise<User | null> {
    if (!token) return null;
    return dbCall('finding user', () =>
      this.userRepository.findOne({ where: { verification_token: token } }),
    );
  }

  findAdmins(adminEmails: string[]): Promise<User[]> {
    return dbCall('finding admins', () =>
      this.userRepository.find({
        where: [
          { role: 'admin' },
          ...adminEmails.map((e) => ({ email: emailEquals(e) })),
        ],
      }),
    );
  }

  findPendingShelters(): Promise<User[]> {
    return dbCall('finding shelters', () =>
      this.userRepository.find({
        where: { shelter_status: 'pending' },
        order: { updated_at: 'ASC' },
      }),
    );
  }

  search(query: string, take: number, skip: number): Promise<[User[], number]> {
    const q = likeEscape(query.trim());
    const where = q
      ? [
          { email: ILike(`%${q}%`) },
          { first_name: ILike(`%${q}%`) },
          { last_name: ILike(`%${q}%`) },
          { shelter_name: ILike(`%${q}%`) },
        ]
      : {};
    return dbCall('searching users', () =>
      this.userRepository.findAndCount({
        where,
        take,
        skip,
        order: { created_at: 'DESC' },
      }),
    );
  }

  // Admin list: users + how many pets they've posted and how many open
  // reports exist against their pets.
  async adminSearch(
    query: string,
    filter: string,
    take: number,
    skip: number,
  ): Promise<
    [{ user: User; listings: number; openReports: number }[], number]
  > {
    const qb = this.userRepository.createQueryBuilder('u');
    const q = likeEscape(query.trim());
    if (q) {
      qb.andWhere(
        '(u.email ILIKE :q OR u.first_name ILIKE :q OR u.last_name ILIKE :q OR u.shelter_name ILIKE :q)',
        { q: `%${q}%` },
      );
    }
    const openReports = (alias: string) =>
      `(SELECT COUNT(*) FROM reports r INNER JOIN listings rl ON rl.id = r."listingId" WHERE rl."userId" = ${alias}.id AND r.status = 'open')`;
    if (filter === 'banned') qb.andWhere('u.is_banned = true');
    if (filter === 'unverified') qb.andWhere('u.is_verified = false');
    if (filter === 'shelters') qb.andWhere(`u.account_type = 'shelter'`);
    if (filter === 'admins') qb.andWhere(`u.role = 'admin'`);
    if (filter === 'reported') qb.andWhere(`${openReports('u')} > 0`);

    const total = await dbCall('counting users', () => qb.getCount());
    qb.addSelect(
      (sub) =>
        sub.select('COUNT(*)').from(Listing, 'cl').where('cl."userId" = u.id'),
      'listings_count',
    )
      .addSelect(openReports('u'), 'open_reports')
      .orderBy('u.created_at', 'DESC')
      .offset(skip)
      .limit(take);
    const { entities, raw } = await dbCall('searching users', () =>
      qb.getRawAndEntities(),
    );
    const byId = new Map(raw.map((r: Record<string, string>) => [r.u_id, r]));
    return [
      entities.map((user) => ({
        user,
        listings: Number(byId.get(user.id)?.listings_count ?? 0),
        openReports: Number(byId.get(user.id)?.open_reports ?? 0),
      })),
      total,
    ];
  }

  // Recipients of an admin broadcast: never banned users or the sender.
  findForBroadcast(audience: string, excludeId: string): Promise<User[]> {
    const qb = this.userRepository
      .createQueryBuilder('u')
      .where('u.is_banned = false')
      .andWhere('u.id <> :excludeId', { excludeId });
    if (audience === 'shelters') {
      qb.andWhere(
        `u.account_type = 'shelter' AND u.shelter_status = 'verified'`,
      );
    }
    if (audience === 'posters') {
      qb.andWhere('EXISTS (SELECT 1 FROM listings l WHERE l."userId" = u.id)');
    }
    return dbCall('finding broadcast recipients', () => qb.getMany());
  }

  count(where: Partial<Record<keyof User, unknown>> = {}): Promise<number> {
    return dbCall('counting users', () =>
      this.userRepository.count({ where: where as object }),
    );
  }

  save(user: Partial<User>): Promise<User> {
    return dbCall('saving user', () => this.userRepository.save(user as User));
  }

  async remove(user: User): Promise<void> {
    await dbCall('removing user', () => this.userRepository.remove(user));
  }
}
