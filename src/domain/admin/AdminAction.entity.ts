import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { User } from '../user/User.entity';

export type AdminActionType =
  | 'ban_user'
  | 'unban_user'
  | 'delete_user'
  | 'hide_listing'
  | 'unhide_listing'
  | 'delete_listing'
  | 'dismiss_report'
  | 'approve_shelter'
  | 'reject_shelter'
  | 'message_user'
  | 'broadcast_message';

// Audit trail of every admin action. target_label is a snapshot (email /
// listing title) so the entry stays readable after the target is deleted.
@Entity({ name: 'admin_actions' })
@Index(['created_at'])
export class AdminAction {
  @PrimaryColumn()
  id: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  admin: User | null;

  @Column({ type: 'varchar' })
  action: AdminActionType;

  @Column({ type: 'varchar' })
  target_type: 'user' | 'listing' | 'report' | 'broadcast';

  @Column({ type: 'varchar' })
  target_id: string;

  @Column({ type: 'text', nullable: true })
  target_label: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
