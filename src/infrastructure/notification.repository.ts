import { AppDataSource } from '@config/data-source';
import { Injectable } from '@nestjs/common';
import { Notification } from '@domain/notification/Notification.entity';
import { SavedSearch } from '@domain/notification/SavedSearch.entity';
import { dbCall } from '@shared/db-call';

@Injectable()
export class NotificationRepository {
  private readonly notifications = AppDataSource.getRepository(Notification);
  private readonly savedSearches = AppDataSource.getRepository(SavedSearch);

  save(n: Notification): Promise<Notification> {
    return dbCall('saving notification', () => this.notifications.save(n));
  }

  findForUser(
    userId: string,
    take: number,
    skip: number,
  ): Promise<[Notification[], number]> {
    return dbCall('finding notifications', () =>
      this.notifications.findAndCount({
        where: { user: { id: userId } },
        order: { created_at: 'DESC' },
        take,
        skip,
      }),
    );
  }

  countUnread(userId: string): Promise<number> {
    return dbCall('counting notifications', () =>
      this.notifications.count({
        where: { user: { id: userId }, is_read: false },
      }),
    );
  }

  async markRead(userId: string, id?: string): Promise<void> {
    await dbCall('updating notifications', () =>
      this.notifications.update(
        { user: { id: userId }, is_read: false, ...(id ? { id } : {}) },
        { is_read: true },
      ),
    );
  }

  // Message notifications for a conversation are cleared when it's opened.
  async markConversationRead(
    userId: string,
    conversationId: string,
  ): Promise<void> {
    await dbCall('updating notifications', () =>
      this.notifications
        .createQueryBuilder()
        .update()
        .set({ is_read: true })
        .where('"userId" = :userId', { userId })
        .andWhere("type = 'message'")
        .andWhere('is_read = false')
        .andWhere(`data::jsonb ->> 'conversation_id' = :conversationId`, {
          conversationId,
        })
        .execute(),
    );
  }

  findAllSavedSearches(): Promise<SavedSearch[]> {
    return dbCall('finding saved searches', () =>
      this.savedSearches.find({ relations: ['user'] }),
    );
  }

  findSavedSearches(userId: string): Promise<SavedSearch[]> {
    return dbCall('finding saved searches', () =>
      this.savedSearches.find({
        where: { user: { id: userId } },
        order: { created_at: 'DESC' },
      }),
    );
  }

  findSavedSearch(id: string): Promise<SavedSearch | null> {
    return dbCall('finding saved search', () =>
      this.savedSearches.findOne({ where: { id }, relations: ['user'] }),
    );
  }

  countSavedSearches(userId: string): Promise<number> {
    return dbCall('counting saved searches', () =>
      this.savedSearches.count({ where: { user: { id: userId } } }),
    );
  }

  saveSavedSearch(s: SavedSearch): Promise<SavedSearch> {
    return dbCall('saving saved search', () => this.savedSearches.save(s));
  }

  async removeSavedSearch(s: SavedSearch): Promise<void> {
    await dbCall('removing saved search', () => this.savedSearches.remove(s));
  }
}
