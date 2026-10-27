import { AppDataSource } from '@config/data-source';
import { Injectable } from '@nestjs/common';
import { Brackets, MoreThan } from 'typeorm';
import { Conversation } from '@domain/messaging/Conversation.entity';
import { Message } from '@domain/messaging/Message.entity';
import { dbCall } from '@shared/db-call';

@Injectable()
export class MessagingRepository {
  private readonly conversations = AppDataSource.getRepository(Conversation);
  private readonly messages = AppDataSource.getRepository(Message);

  findConversation(id: string): Promise<Conversation | null> {
    return dbCall('finding conversation', () =>
      this.conversations.findOne({
        where: { id },
        relations: ['owner', 'participant', 'listing'],
      }),
    );
  }

  findByListingAndParticipant(listingId: string, participantId: string) {
    return dbCall('finding conversation', () =>
      this.conversations.findOne({
        where: {
          listing: { id: listingId },
          participant: { id: participantId },
        },
        relations: ['owner', 'participant', 'listing'],
      }),
    );
  }

  findSupport(ownerId: string, participantId: string) {
    return dbCall('finding conversation', () =>
      this.conversations.findOne({
        where: {
          is_support: true,
          owner: { id: ownerId },
          participant: { id: participantId },
        },
        relations: ['owner', 'participant', 'listing'],
      }),
    );
  }

  findForUser(
    userId: string,
    take: number,
    skip: number,
  ): Promise<[Conversation[], number]> {
    return dbCall('finding conversations', () =>
      this.conversations
        .createQueryBuilder('c')
        .leftJoinAndSelect('c.owner', 'o')
        .leftJoinAndSelect('c.participant', 'p')
        .leftJoinAndSelect('c.listing', 'l')
        .where(
          new Brackets((w) =>
            w.where('o.id = :userId').orWhere('p.id = :userId'),
          ),
        )
        .setParameter('userId', userId)
        .orderBy('c.last_message_at', 'DESC')
        .offset(skip)
        .limit(take)
        .getManyAndCount(),
    );
  }

  // Conversations with a message newer than the user's last read.
  countUnread(userId: string): Promise<number> {
    return dbCall('counting unread', () =>
      this.conversations
        .createQueryBuilder('c')
        .leftJoin('c.owner', 'o')
        .leftJoin('c.participant', 'p')
        .where(
          new Brackets((w) =>
            w
              .where(
                '(o.id = :userId AND (c.owner_last_read_at IS NULL OR c.last_message_at > c.owner_last_read_at))',
              )
              .orWhere(
                '(p.id = :userId AND (c.participant_last_read_at IS NULL OR c.last_message_at > c.participant_last_read_at))',
              ),
          ),
        )
        .setParameter('userId', userId)
        .getCount(),
    );
  }

  // Newest `take` messages, oldest-first. With `afterId` (polling), only
  // messages newer than that one — compared in SQL at full microsecond
  // precision; a JS Date round-trip (milliseconds) would re-return it.
  async findMessages(
    conversationId: string,
    take: number,
    afterId?: string,
  ): Promise<Message[]> {
    const qb = this.messages
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.sender', 's')
      .where('m."conversationId" = :conversationId', { conversationId });
    if (afterId) {
      qb.andWhere(
        'm.created_at > (SELECT x.created_at FROM messages x WHERE x.id = :afterId AND x."conversationId" = :conversationId)',
        { afterId },
      );
    }
    const rows = await dbCall('finding messages', () =>
      qb.orderBy('m.created_at', 'DESC').take(take).getMany(),
    );
    return rows.reverse();
  }

  // Messages from `senderId` newer than `since` — used to decide whether the
  // recipient already has an unread one (then skip another email).
  countSince(
    conversationId: string,
    senderId: string,
    since: Date | null,
  ): Promise<number> {
    return dbCall('counting messages', () =>
      this.messages.count({
        where: {
          conversation: { id: conversationId },
          sender: { id: senderId },
          ...(since ? { created_at: MoreThan(since) } : {}),
        },
      }),
    );
  }

  saveConversation(c: Conversation): Promise<Conversation> {
    return dbCall('saving conversation', () => this.conversations.save(c));
  }

  saveMessage(m: Message): Promise<Message> {
    return dbCall('saving message', () => this.messages.save(m));
  }

  // GDPR export: every message the user sent.
  findSentBy(userId: string): Promise<Message[]> {
    return dbCall('finding messages', () =>
      this.messages.find({
        where: { sender: { id: userId } },
        relations: ['conversation'],
        order: { created_at: 'ASC' },
      }),
    );
  }
}
