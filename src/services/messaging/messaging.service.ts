import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { Conversation } from '@domain/messaging/Conversation.entity';
import { Message } from '@domain/messaging/Message.entity';
import { User } from '@domain/user/User.entity';
import { publicUser } from '@domain/user/public-user';
import { MessagingRepository } from '@infrastructure/messaging.repository';
import { ListingRepository } from '@infrastructure/listing.repository';
import { Pagination } from '@shared/pagination.helper';
import { UserService } from '../user/user.service';
import { NotificationService } from '../notification/notification.service';

const preview = (body: string) =>
  body.length > 140 ? `${body.slice(0, 137)}…` : body;

@Injectable()
export class MessagingService {
  constructor(
    private readonly userService: UserService,
    private readonly notificationService: NotificationService,
    private readonly messagingRepository: MessagingRepository,
    private readonly listingRepository: ListingRepository,
  ) {}

  private async participantConversation(id: string, me: User) {
    const c = await this.messagingRepository.findConversation(id);
    if (!c || (c.owner.id !== me.id && c.participant.id !== me.id)) {
      throw new NotFoundException('Conversation not found');
    }
    return c;
  }

  private summarize(c: Conversation, me: User) {
    const isOwner = c.owner.id === me.id;
    const other = isOwner ? c.participant : c.owner;
    const myLastRead = isOwner
      ? c.owner_last_read_at
      : c.participant_last_read_at;
    const firstImage = [...(c.listing?.images ?? [])].sort(
      (a, b) => a.position - b.position,
    )[0];
    return {
      id: c.id,
      role: isOwner ? 'owner' : 'participant',
      is_support: c.is_support,
      other: publicUser(other),
      other_banned: other.is_banned,
      listing: c.listing && {
        id: c.listing.id,
        title: c.listing.title,
        image: firstImage?.url ?? null,
        listing_type: c.listing.listing_type,
        is_adopted: c.listing.is_adopted,
      },
      last_message_at: c.last_message_at,
      last_message_preview: c.last_message_preview,
      unread: !myLastRead || c.last_message_at > myLastRead,
    };
  }

  async list(token: string, pagination: Pagination) {
    const me = await this.userService.getMe(token, []);
    const take = Math.min(pagination.limit || 20, 50);
    const page = pagination.page || 1;
    const [conversations, total] = await this.messagingRepository.findForUser(
      me.id,
      take,
      (page - 1) * take,
    );
    return {
      conversations: conversations.map((c) => this.summarize(c, me)),
      meta: { total, page, take, totalPages: Math.ceil(total / take) },
    };
  }

  async unreadCount(token: string) {
    const me = await this.userService.getMe(token, []);
    return { count: await this.messagingRepository.countUnread(me.id) };
  }

  async get(token: string, id: string) {
    const me = await this.userService.getMe(token, []);
    return this.summarize(await this.participantConversation(id, me), me);
  }

  // Returns the latest messages (or only those after message id `after`, for polling)
  // and marks the conversation read for the caller.
  async messages(token: string, id: string, after?: string) {
    const me = await this.userService.getMe(token, []);
    const c = await this.participantConversation(id, me);
    if (after && !/^[0-9a-f-]{36}$/.test(after)) {
      throw new BadRequestException('Invalid after');
    }

    const messages = await this.messagingRepository.findMessages(
      c.id,
      100,
      after,
    );

    const now = new Date();
    if (c.owner.id === me.id) c.owner_last_read_at = now;
    else c.participant_last_read_at = now;
    await this.messagingRepository.saveConversation(c);
    await this.notificationService.markConversationRead(me.id, c.id);

    return messages.map((m) => ({
      id: m.id,
      body: m.body,
      created_at: m.created_at,
      sender_id: m.sender.id,
      mine: m.sender.id === me.id,
    }));
  }

  // First contact about a listing: reuses the existing thread if there is one.
  async start(token: string, listingId: string, body: string) {
    const me = await this.userService.requireVerified(token);
    const listing = await this.listingRepository.findById(listingId, ['user']);
    if (!listing || listing.is_hidden || listing.user?.is_banned) {
      throw new NotFoundException('Listing not found');
    }
    if (listing.user.id === me.id) {
      throw new BadRequestException('You cannot message yourself');
    }

    let c = await this.messagingRepository.findByListingAndParticipant(
      listing.id,
      me.id,
    );
    if (!c) {
      c = new Conversation();
      c.id = uuidv4();
      c.listing = listing;
      c.owner = listing.user;
      c.participant = me;
      c.last_message_at = new Date();
      c = await this.messagingRepository.saveConversation(c);
    }
    await this.post(c, me, body);
    return { id: c.id };
  }

  async send(token: string, id: string, body: string) {
    const me = await this.userService.requireVerified(token);
    const c = await this.participantConversation(id, me);
    const message = await this.post(c, me, body);
    return {
      id: message.id,
      body: message.body,
      created_at: message.created_at,
      sender_id: me.id,
      mine: true,
    };
  }

  // Admin -> user message "from the Udomi me team": reuses this admin's
  // support thread with the user, or starts one (no listing attached).
  async sendAsTeam(admin: User, recipient: User, body: string) {
    let c = await this.messagingRepository.findSupport(admin.id, recipient.id);
    if (!c) {
      c = new Conversation();
      c.id = uuidv4();
      c.listing = null;
      c.owner = admin;
      c.participant = recipient;
      c.is_support = true;
      c.last_message_at = new Date();
      c = await this.messagingRepository.saveConversation(c);
    }
    await this.post(c, admin, body);
    return c;
  }

  // No notification or email: the recipient sees the unread badge on the
  // messages icon (driven by the conversation's last_read_at).
  private async post(c: Conversation, me: User, rawBody: string) {
    const body = rawBody.trim();
    if (!body) throw new BadRequestException('Message is empty');

    const isOwner = c.owner.id === me.id;
    const recipient = isOwner ? c.participant : c.owner;
    if (recipient.is_banned)
      throw new ForbiddenException('This user is no longer available');

    const m = new Message();
    m.id = uuidv4();
    m.conversation = { id: c.id } as Conversation;
    m.sender = { id: me.id } as User;
    m.body = body;
    const saved = await this.messagingRepository.saveMessage(m);

    c.last_message_at = saved.created_at;
    c.last_message_preview = preview(body);
    if (isOwner) c.owner_last_read_at = saved.created_at;
    else c.participant_last_read_at = saved.created_at;
    await this.messagingRepository.saveConversation(c);

    return saved;
  }
}
