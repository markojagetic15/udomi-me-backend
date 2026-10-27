import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { ListingRepository } from '@infrastructure/listing.repository';
import { ReportRepository } from '@infrastructure/report.repository';
import { UserRepository } from '@infrastructure/user.repository';
import { AdminActionRepository } from '@infrastructure/admin-action.repository';
import { Pagination } from '@shared/pagination.helper';
import { User } from '@domain/user/User.entity';
import { Listing } from '@domain/listing/Listing.entity';
import { publicUser } from '@domain/user/public-user';
import { AdminAction, AdminActionType } from '@domain/admin/AdminAction.entity';
import { UserService, deleteUploadedFiles } from '../user/user.service';
import { NotificationService } from '../notification/notification.service';
import { MessagingService } from '../messaging/messaging.service';

const pageOf = (p: Pagination) => {
  const take = Math.min(Math.max(p.limit || 20, 1), 100);
  const page = Math.max(p.page || 1, 1);
  return { take, page, skip: (page - 1) * take };
};

const meta = (total: number, page: number, take: number) => ({
  total,
  page,
  take,
  totalPages: Math.ceil(total / take),
});

// Admin view of a user: public shape plus moderation-relevant fields.
const adminUser = (u: User | null) =>
  u && {
    ...publicUser(u),
    last_name: u.last_name,
    email: u.email,
    role: u.role,
    is_banned: u.is_banned,
    is_verified: u.is_verified,
    has_password: !!u.password,
    language: u.language,
    account_type: u.account_type,
    shelter_status: u.shelter_status,
    shelter_name: u.shelter_name,
    shelter_city: u.shelter_city,
    shelter_description: u.shelter_description,
    shelter_website: u.shelter_website,
    shelter_phone: u.shelter_phone,
    created_at: u.created_at,
    updated_at: u.updated_at,
  };

const adminListing = (l: Listing) => ({ ...l, user: adminUser(l.user) });

// Every method re-checks admin rights via UserService.requireAdmin, and every
// state-changing one writes an AdminAction audit entry.
@Injectable()
export class AdminService {
  constructor(
    private readonly userService: UserService,
    private readonly notificationService: NotificationService,
    private readonly userRepository: UserRepository,
    private readonly listingRepository: ListingRepository,
    private readonly reportRepository: ReportRepository,
    private readonly adminActionRepository: AdminActionRepository,
    private readonly messagingService: MessagingService,
  ) {}

  private async log(
    admin: User,
    action: AdminActionType,
    targetType: AdminAction['target_type'],
    targetId: string,
    label: string | null,
  ) {
    const a = new AdminAction();
    a.id = uuidv4();
    a.admin = { id: admin.id } as User;
    a.action = action;
    a.target_type = targetType;
    a.target_id = targetId;
    a.target_label = label;
    await this.adminActionRepository.save(a);
  }

  async stats(token: string) {
    await this.userService.requireAdmin(token);
    const [
      users,
      listings,
      adopted,
      openReports,
      pendingShelters,
      verifiedShelters,
      bannedUsers,
      hiddenListings,
    ] = await Promise.all([
      this.userRepository.count(),
      this.listingRepository.count({
        is_hidden: false,
        is_adopted: false,
        is_active: true,
      }),
      this.listingRepository.count({ is_adopted: true }),
      this.reportRepository.count({ status: 'open' }),
      this.userRepository.count({ shelter_status: 'pending' }),
      this.userRepository.count({ shelter_status: 'verified' }),
      this.userRepository.count({ is_banned: true }),
      this.listingRepository.count({ is_hidden: true }),
    ]);
    return {
      users,
      listings,
      adopted,
      openReports,
      pendingShelters,
      verifiedShelters,
      bannedUsers,
      hiddenListings,
    };
  }

  // ---------------- reports ----------------

  async reports(token: string, status: string, pagination: Pagination) {
    await this.userService.requireAdmin(token);
    if (!['open', 'resolved', 'dismissed'].includes(status)) {
      throw new BadRequestException('Invalid status');
    }
    const { take, page, skip } = pageOf(pagination);
    const [reports, total] = await this.reportRepository.findByStatus(
      status as 'open' | 'resolved' | 'dismissed',
      take,
      skip,
    );
    return {
      reports: reports.map((r) => ({
        ...r,
        reporter: adminUser(r.reporter),
        listing: r.listing && adminListing(r.listing),
      })),
      meta: meta(total, page, take),
    };
  }

  async resolveReport(
    token: string,
    id: string,
    action: 'dismiss' | 'hide_listing' | 'ban_user',
  ) {
    const admin = await this.userService.requireAdmin(token);
    const report = await this.reportRepository.findById(id);
    if (!report) throw new NotFoundException('Report not found');

    if (action === 'dismiss') {
      report.status = 'dismissed';
      report.action = null;
      report.resolved_at = new Date();
      await this.reportRepository.save(report);
      await this.log(
        admin,
        'dismiss_report',
        'report',
        report.id,
        report.listing?.title ?? null,
      );
      return { ok: true };
    }

    if (action === 'hide_listing')
      await this.setListingHidden(token, report.listing.id, true);
    if (action === 'ban_user')
      await this.setUserBanned(token, report.listing.user.id, true);
    // Acting on one report settles every open report about the same listing.
    await this.reportRepository.closeOpenForListing(
      report.listing.id,
      'resolved',
      action,
    );
    return { ok: true };
  }

  // ---------------- listings ----------------

  async listings(
    token: string,
    query: { search?: string; status?: string; type?: string },
    pagination: Pagination,
  ) {
    await this.userService.requireAdmin(token);
    const { take, page, skip } = pageOf(pagination);
    const [rows, total] = await this.listingRepository.adminSearch(
      query.search ?? '',
      query.status ?? 'all',
      query.type ?? 'all',
      take,
      skip,
    );
    return {
      listings: rows.map(({ listing, openReports }) => ({
        ...adminListing(listing),
        open_reports: openReports,
      })),
      meta: meta(total, page, take),
    };
  }

  async listingDetail(token: string, id: string) {
    await this.userService.requireAdmin(token);
    const listing = await this.listingRepository.findById(id, ['user']);
    if (!listing) throw new NotFoundException('Listing not found');
    const [reports, [history]] = await Promise.all([
      this.reportRepository.findForListing(id),
      this.adminActionRepository.findPage(50, 0, id),
    ]);
    return {
      listing: adminListing(listing),
      reports: reports.map((r) => ({ ...r, reporter: adminUser(r.reporter) })),
      history: history.map((h) => ({ ...h, admin: adminUser(h.admin) })),
    };
  }

  async setListingHidden(token: string, listingId: string, hidden: boolean) {
    const admin = await this.userService.requireAdmin(token);
    const listing = await this.listingRepository.findById(listingId, ['user']);
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.is_hidden === hidden) return { ok: true };
    await this.listingRepository.update(listing.id, { is_hidden: hidden });
    await this.log(
      admin,
      hidden ? 'hide_listing' : 'unhide_listing',
      'listing',
      listing.id,
      listing.title,
    );
    if (hidden && listing.user) {
      await this.notificationService.notify(listing.user, 'listing_hidden', {
        listing_id: listing.id,
        listing_title: listing.title,
      });
    }
    return { ok: true };
  }

  async deleteListing(token: string, listingId: string) {
    const admin = await this.userService.requireAdmin(token);
    const listing = await this.listingRepository.findById(listingId, ['user']);
    if (!listing) throw new NotFoundException('Listing not found');
    await this.listingRepository.remove(listing);
    await deleteUploadedFiles((listing.images ?? []).map((i) => i.url));
    await this.log(
      admin,
      'delete_listing',
      'listing',
      listingId,
      listing.title,
    );
    if (listing.user && listing.user.id !== admin.id) {
      await this.notificationService.notify(listing.user, 'listing_removed', {
        listing_title: listing.title,
      });
    }
    return { ok: true };
  }

  // ---------------- users ----------------

  async users(
    token: string,
    query: { search?: string; filter?: string },
    pagination: Pagination,
  ) {
    await this.userService.requireAdmin(token);
    const { take, page, skip } = pageOf(pagination);
    const [rows, total] = await this.userRepository.adminSearch(
      query.search ?? '',
      query.filter ?? 'all',
      take,
      skip,
    );
    return {
      users: rows.map(({ user, listings, openReports }) => ({
        ...adminUser(user),
        listings_count: listings,
        open_reports: openReports,
      })),
      meta: meta(total, page, take),
    };
  }

  async userDetail(token: string, id: string) {
    await this.userService.requireAdmin(token);
    const user = await this.userRepository.findById(id);
    if (!user) throw new NotFoundException('User not found');
    const [[listings], against, filed, [history]] = await Promise.all([
      this.listingRepository.findByOwner(id, 100, 0),
      this.reportRepository.findAgainstUser(id),
      this.reportRepository.findByReporter(id),
      this.adminActionRepository.findPage(50, 0, id),
    ]);
    return {
      user: adminUser(user),
      listings,
      reports_against: against.map((r) => ({
        ...r,
        reporter: adminUser(r.reporter),
      })),
      reports_filed: filed,
      history: history.map((h) => ({ ...h, admin: adminUser(h.admin) })),
    };
  }

  // Admins can't be banned or deleted from the panel (not even by another
  // admin) — demote in the DB / ADMIN_EMAILS first. Prevents lock-out.
  private async moderatableUser(admin: User, userId: string) {
    if (admin.id === userId)
      throw new BadRequestException('You cannot do this to your own account');
    const user = await this.userRepository.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    if (user.role === 'admin')
      throw new BadRequestException('Admins cannot be banned or deleted');
    return user;
  }

  async setUserBanned(token: string, userId: string, banned: boolean) {
    const admin = await this.userService.requireAdmin(token);
    const user = await this.moderatableUser(admin, userId);
    if (user.is_banned === banned) return { ok: true };
    await this.userRepository.save({ id: user.id, is_banned: banned });
    await this.log(
      admin,
      banned ? 'ban_user' : 'unban_user',
      'user',
      user.id,
      user.email,
    );
    return { ok: true };
  }

  // Permanent: account + all their pets, photos, messages (see
  // UserService.deleteAccount). The frontend requires typing the email.
  async deleteUser(token: string, userId: string, confirmEmail: string) {
    const admin = await this.userService.requireAdmin(token);
    const user = await this.moderatableUser(admin, userId);
    if (
      user.email.toLowerCase() !== (confirmEmail ?? '').trim().toLowerCase()
    ) {
      throw new BadRequestException('CONFIRMATION_MISMATCH');
    }
    await this.userService.deleteAccount(user);
    await this.log(admin, 'delete_user', 'user', userId, user.email);
    return { ok: true };
  }

  // ---------------- shelters ----------------

  async pendingShelters(token: string) {
    await this.userService.requireAdmin(token);
    return (await this.userRepository.findPendingShelters()).map(adminUser);
  }

  async reviewShelter(token: string, userId: string, approve: boolean) {
    const admin = await this.userService.requireAdmin(token);
    const user = await this.userRepository.findById(userId);
    if (!user || user.account_type !== 'shelter')
      throw new NotFoundException('Shelter not found');
    user.shelter_status = approve ? 'verified' : 'rejected';
    await this.userRepository.save({
      id: user.id,
      shelter_status: user.shelter_status,
    });
    await this.log(
      admin,
      approve ? 'approve_shelter' : 'reject_shelter',
      'user',
      user.id,
      user.shelter_name,
    );
    await this.notificationService.notify(
      user,
      approve ? 'shelter_verified' : 'shelter_rejected',
      {
        user_id: user.id,
        shelter_name: user.shelter_name,
      },
    );
    return { ok: true };
  }

  // ---------------- messages from the team ----------------

  // Direct message to one user, in their normal inbox ("Udomi me" thread).
  // Gets the usual notification + email copy (if they allow email).
  async messageUser(token: string, userId: string, body: string) {
    const admin = await this.userService.requireAdmin(token);
    if (admin.id === userId)
      throw new BadRequestException('You cannot message yourself');
    const user = await this.userRepository.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    if (user.is_banned) throw new BadRequestException('This user is banned');
    const c = await this.messagingService.sendAsTeam(admin, user, body, true);
    await this.log(admin, 'message_user', 'user', user.id, user.email);
    return { conversation_id: c.id };
  }

  async broadcastCount(token: string, audience: string) {
    const admin = await this.userService.requireAdmin(token);
    const users = await this.userRepository.findForBroadcast(
      audience,
      admin.id,
    );
    return { count: users.length };
  }

  // Same message to many users, each in their own "Udomi me" thread.
  // In-app only (no email copies): a broadcast would exceed the email
  // provider's daily limit and isn't something users opted into by email.
  async broadcast(token: string, audience: string, body: string) {
    const admin = await this.userService.requireAdmin(token);
    const users = await this.userRepository.findForBroadcast(
      audience,
      admin.id,
    );
    let sent = 0;
    for (const u of users) {
      try {
        await this.messagingService.sendAsTeam(admin, u, body, false);
        sent++;
      } catch (e) {
        console.error(`Broadcast to ${u.id} failed:`, (e as Error).message);
      }
    }
    const short = body.trim().replace(/\s+/g, ' ');
    await this.log(
      admin,
      'broadcast_message',
      'broadcast',
      audience,
      `${sent} · ${short.length > 60 ? `${short.slice(0, 57)}...` : short}`,
    );
    return { sent };
  }

  // ---------------- audit ----------------

  async activity(token: string, pagination: Pagination) {
    await this.userService.requireAdmin(token);
    const { take, page, skip } = pageOf(pagination);
    const [rows, total] = await this.adminActionRepository.findPage(take, skip);
    return {
      actions: rows.map((a) => ({ ...a, admin: adminUser(a.admin) })),
      meta: meta(total, page, take),
    };
  }
}
