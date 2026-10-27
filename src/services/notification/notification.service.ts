import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  Notification,
  NotificationType,
} from '@domain/notification/Notification.entity';
import { SavedSearch } from '@domain/notification/SavedSearch.entity';
import { User } from '@domain/user/User.entity';
import { Listing } from '@domain/listing/Listing.entity';
import {
  matchesFilters,
  ListingFilters,
} from '@domain/listing/listing-filters';
import { NotificationRepository } from '@infrastructure/notification.repository';
import { UserRepository } from '@infrastructure/user.repository';
import { MailService } from '@shared/mail.service';
import { emailCopy } from './email-copy';

type Data = Record<string, string | number | null>;

const MAX_SAVED_SEARCHES = 10;

@Injectable()
export class NotificationService {
  constructor(
    private readonly notificationRepository: NotificationRepository,
    private readonly userRepository: UserRepository,
    private readonly mail: MailService,
  ) {}

  // In-app notification + (if the user allows it) an email in their language.
  async notify(
    user: User,
    type: NotificationType,
    data: Data,
    email = true,
  ): Promise<void> {
    const n = new Notification();
    n.id = uuidv4();
    n.user = { id: user.id } as User;
    n.type = type;
    n.data = data;
    await this.notificationRepository.save(n);

    if (email && user.email_notifications !== false && !user.is_banned) {
      const lang = user.language === 'en' ? 'en' : 'hr';
      const copy = emailCopy[type];
      if (copy) {
        await this.mail.send(
          { email: user.email, name: `${user.first_name} ${user.last_name}` },
          copy(lang, data),
          lang,
        );
      }
    }
  }

  async notifyAdmins(type: NotificationType, data: Data): Promise<void> {
    const admins = await this.userRepository.findAdmins(adminEmails());
    await Promise.all(admins.map((a) => this.notify(a, type, data)));
  }

  // Called after a listing is created: alert everyone whose saved search matches.
  async notifySavedSearches(listing: Listing, owner: User): Promise<void> {
    const searches = await this.notificationRepository.findAllSavedSearches();
    const ownerIsShelter = owner.shelter_status === 'verified';
    const alerted = new Set<string>();
    for (const s of searches) {
      if (!s.user || s.user.id === owner.id || alerted.has(s.user.id)) continue;
      if (!matchesFilters(listing, s.filters, ownerIsShelter)) continue;
      alerted.add(s.user.id);
      await this.notify(s.user, 'saved_search_match', {
        listing_id: listing.id,
        listing_title: listing.title,
        saved_search_id: s.id,
        saved_search_name: s.name,
      });
    }
  }

  async list(user: User, take: number, skip: number) {
    const [notifications, total] =
      await this.notificationRepository.findForUser(user.id, take, skip);
    return {
      notifications,
      meta: { total, totalPages: Math.ceil(total / take) },
    };
  }

  async unreadCount(user: User) {
    return { count: await this.notificationRepository.countUnread(user.id) };
  }

  async markRead(user: User, id?: string) {
    await this.notificationRepository.markRead(user.id, id);
    return { ok: true };
  }

  markConversationRead(userId: string, conversationId: string) {
    return this.notificationRepository.markConversationRead(
      userId,
      conversationId,
    );
  }

  getSavedSearches(user: User) {
    return this.notificationRepository.findSavedSearches(user.id);
  }

  async createSavedSearch(user: User, name: string, filters: ListingFilters) {
    if (
      (await this.notificationRepository.countSavedSearches(user.id)) >=
      MAX_SAVED_SEARCHES
    ) {
      throw new BadRequestException(
        `You can save at most ${MAX_SAVED_SEARCHES} searches`,
      );
    }
    const s = new SavedSearch();
    s.id = uuidv4();
    s.user = { id: user.id } as User;
    s.name = name.trim().slice(0, 80);
    s.filters = filters;
    const saved = await this.notificationRepository.saveSavedSearch(s);
    return {
      id: saved.id,
      name: saved.name,
      filters: saved.filters,
      created_at: saved.created_at,
    };
  }

  async deleteSavedSearch(user: User, id: string) {
    const s = await this.notificationRepository.findSavedSearch(id);
    if (!s || s.user?.id !== user.id)
      throw new NotFoundException('Saved search not found');
    await this.notificationRepository.removeSavedSearch(s);
    return { ok: true };
  }
}

export const adminEmails = () =>
  (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
