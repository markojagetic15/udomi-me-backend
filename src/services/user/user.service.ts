import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { UpdateUserDto } from '@application/dto/user/update-user.dto';
import { ShelterApplicationDto } from '@application/dto/user/shelter-application.dto';
import { encrypt } from '@shared/encrypt';
import { UPLOAD_DIR } from '@shared/upload-dir';
import { UserRepository } from '@infrastructure/user.repository';
import { ListingRepository } from '@infrastructure/listing.repository';
import { AuthRepository } from '@infrastructure/auth.repository';
import { MessagingRepository } from '@infrastructure/messaging.repository';
import { NotificationRepository } from '@infrastructure/notification.repository';
import { Pagination } from '@shared/pagination.helper';
import { User } from '@domain/user/User.entity';
import { publicUser } from '@domain/user/public-user';
import { adminEmails } from '@services/notification/notification.service';
import { NotificationService } from '@services/notification/notification.service';
import { MailService } from '@shared/mail.service';

// Only files we created (POST /upload) — never touch anything else on disk.
// (the photo plus its cached link-preview JPEG, see ShareService.ogImage).
const uploadFilesFor = (url: string | null | undefined) => {
  const m = /^\/api\/uploads\/([0-9a-f-]{36})\.webp$/.exec(url ?? '');
  return m
    ? [join(UPLOAD_DIR, `${m[1]}.webp`), join(UPLOAD_DIR, 'og', `${m[1]}.jpg`)]
    : [];
};

export const deleteUploadedFiles = async (
  urls: (string | null | undefined)[],
) => {
  await Promise.all(
    urls.flatMap(uploadFilesFor).map((f) => unlink(f).catch(() => undefined)),
  );
};

@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly listingRepository: ListingRepository,
    private readonly authRepository: AuthRepository,
    private readonly messagingRepository: MessagingRepository,
    private readonly notificationRepository: NotificationRepository,
    private readonly notificationService: NotificationService,
    private readonly mail: MailService,
  ) {}

  // The one place identity is resolved from the auth cookie. Throws 401 for
  // a missing/invalid token, 403 for a banned account.
  async getMe(
    token: string,
    relations = ['favorite_listings', 'interested_listings'],
  ) {
    if (!token) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    let decode: { id: string };
    try {
      decode = encrypt.verifyToken(token);
    } catch {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    const user = await this.userRepository.findById(decode.id, relations);

    if (!user) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }
    if (user.is_banned) {
      throw new ForbiddenException('ACCOUNT_BANNED');
    }

    // ADMIN_EMAILS bootstraps admins without touching the DB by hand.
    if (
      user.role !== 'admin' &&
      adminEmails().includes(user.email.toLowerCase())
    ) {
      user.role = 'admin';
      await this.userRepository.save({ id: user.id, role: 'admin' });
    }

    return user;
  }

  // For endpoints that work logged-out but behave differently logged-in.
  async getMeOptional(token: string | undefined): Promise<User | null> {
    if (!token) return null;
    try {
      return await this.getMe(token, []);
    } catch {
      return null;
    }
  }

  async requireAdmin(token: string) {
    const me = await this.getMe(token, []);
    if (me.role !== 'admin') throw new ForbiddenException('Admins only');
    return me;
  }

  verificationRequired() {
    return this.mail.isConfigured();
  }

  // Posting/messaging needs a verified email — but only once email can
  // actually be delivered, otherwise nobody could ever verify.
  async requireVerified(token: string, relations: string[] = []) {
    const me = await this.getMe(token, relations);
    if (!me.is_verified && this.mail.isConfigured()) {
      throw new ForbiddenException('EMAIL_NOT_VERIFIED');
    }
    return me;
  }

  async updateMe(body: UpdateUserDto, token: string) {
    const me = await this.getMe(token);
    const oldAvatar = me.avatar_url;
    Object.assign(me, body);
    await this.userRepository.save(me);
    if (
      body.avatar_url !== undefined &&
      oldAvatar &&
      oldAvatar !== body.avatar_url
    ) {
      await deleteUploadedFiles([oldAvatar]);
    }
    return me;
  }

  async applyAsShelter(body: ShelterApplicationDto, token: string) {
    const me = await this.getMe(token);
    const identityChanged =
      me.shelter_name !== body.shelter_name ||
      me.shelter_city !== body.shelter_city;

    me.account_type = 'shelter';
    me.shelter_name = body.shelter_name.trim();
    me.shelter_city = body.shelter_city.trim();
    me.shelter_description = body.shelter_description.trim();
    me.shelter_website = body.shelter_website?.trim() || null;
    me.shelter_phone = body.shelter_phone?.trim() || null;

    // Editing contact details keeps a verified badge; renaming re-triggers review.
    const needsReview = me.shelter_status !== 'verified' || identityChanged;
    if (needsReview) me.shelter_status = 'pending';
    await this.userRepository.save(me);

    if (needsReview) {
      await this.notificationService.notifyAdmins('shelter_application', {
        user_id: me.id,
        shelter_name: me.shelter_name,
      });
    }
    return me;
  }

  async withdrawShelter(token: string) {
    const me = await this.getMe(token);
    me.account_type = 'individual';
    me.shelter_status = 'none';
    await this.userRepository.save(me);
    return me;
  }

  async getPublicProfile(id: string) {
    const user = await this.userRepository.findById(id);
    if (!user || user.is_banned) throw new NotFoundException('User not found');
    const [active, adopted] = await Promise.all([
      this.listingRepository
        .search({}, 'newest', 1, 0, user.id)
        .then(([, n]) => n),
      this.listingRepository.count({
        user: { id: user.id },
        is_adopted: true,
        is_hidden: false,
      }),
    ]);
    return {
      user: publicUser(user),
      stats: { active_listings: active, adopted },
    };
  }

  async getPublicListings(id: string, pagination: Pagination) {
    const take = Math.min(pagination.limit || 12, 48);
    const page = pagination.page || 1;
    const [listings, total] = await this.listingRepository.search(
      {},
      'newest',
      take,
      (page - 1) * take,
      id,
    );
    return {
      listings: listings.map((l) => ({ ...l, user: publicUser(l.user) })),
      meta: { total, page, take, totalPages: Math.ceil(total / take) },
    };
  }

  async getMyFavorites(token: string) {
    const me = await this.getMe(token, [
      'favorite_listings',
      'favorite_listings.user',
    ]);
    return me.favorite_listings
      .filter((l) => !l.is_hidden)
      .map((l) => ({ ...l, user: publicUser(l.user) }));
  }

  // GDPR art. 17: deletes the account and everything that cascades from it
  // (listings, conversations, messages, notifications, saved searches) plus
  // the uploaded photo files. Reports they filed stay, anonymised.
  async deleteMe(token: string) {
    const me = await this.getMe(token, []);
    await this.deleteAccount(me);
    return { message: 'Account deleted' };
  }

  // Shared by self-deletion and admin deletion: the user row (cascading to
  // listings, conversations, messages, notifications, saved searches), reset
  // tokens, and every uploaded photo file.
  async deleteAccount(user: User) {
    const listings = await this.listingRepository.findImagesByOwner(user.id);
    const files = [
      user.avatar_url,
      ...listings.flatMap((l) => (l.images ?? []).map((i) => i.url)),
    ];
    await this.authRepository.deleteForUser(user.id);
    await this.userRepository.remove(user);
    await deleteUploadedFiles(files);
  }

  // GDPR art. 15/20: everything we hold about the caller, as JSON.
  async exportMe(token: string) {
    const me = await this.getMe(token);
    const [[listings], messages, savedSearches] = await Promise.all([
      this.listingRepository.findByOwner(me.id, 10000, 0),
      this.messagingRepository.findSentBy(me.id),
      this.notificationRepository.findSavedSearches(me.id),
    ]);
    return {
      exported_at: new Date().toISOString(),
      account: me,
      listings,
      favorite_listing_ids: me.favorite_listings.map((l) => l.id),
      interested_listing_ids: me.interested_listings.map((l) => l.id),
      messages_sent: messages.map((m) => ({
        conversation_id: m.conversation?.id,
        body: m.body,
        created_at: m.created_at,
      })),
      saved_searches: savedSearches,
    };
  }
}
