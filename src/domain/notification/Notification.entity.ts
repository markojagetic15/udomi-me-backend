import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { User } from '../user/User.entity';

// The frontend renders text from `type` + `data` (localized there), so no
// user-facing copy is stored here.
export type NotificationType =
  | 'message'
  | 'interest'
  | 'saved_search_match'
  | 'listing_hidden'
  | 'listing_removed'
  | 'shelter_verified'
  | 'shelter_rejected'
  | 'shelter_application';

@Entity({ name: 'notifications' })
@Index(['user', 'created_at'])
export class Notification {
  @PrimaryColumn()
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column({ type: 'varchar' })
  type: NotificationType;

  // e.g. { listing_id, listing_title, conversation_id, from_name, saved_search_name }
  @Column('json', { default: {} })
  data: Record<string, string | number | null>;

  @Column({ default: false })
  is_read: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
