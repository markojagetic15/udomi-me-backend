import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { Listing } from '../listing/Listing.entity';
import { User } from '../user/User.entity';

export const REPORT_REASONS = [
  'scam',
  'animal_welfare',
  'selling',
  'inappropriate',
  'duplicate',
  'other',
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

@Entity({ name: 'reports' })
export class Report {
  @PrimaryColumn()
  id: string;

  @ManyToOne(() => Listing, { onDelete: 'CASCADE' })
  listing: Listing;

  // Reporter is kept anonymous to the listing owner; SET NULL so deleting the
  // reporter's account doesn't erase the report.
  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  reporter: User | null;

  @Column({ type: 'varchar' })
  reason: ReportReason;

  @Column({ nullable: true, type: 'text' })
  details: string | null;

  @Column({ type: 'varchar', default: 'open' })
  status: 'open' | 'resolved' | 'dismissed';

  // What the admin did when resolving: 'hide_listing' | 'ban_user' | null.
  @Column({ nullable: true, type: 'varchar' })
  action: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @Column({ nullable: true, type: 'timestamptz' })
  resolved_at: Date | null;
}
