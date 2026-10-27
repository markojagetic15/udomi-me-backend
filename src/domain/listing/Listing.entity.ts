import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../user/User.entity';
import { Category } from '@domain/listing/Category.enum';

export const LISTING_TYPES = ['adoption', 'lost', 'found'] as const;
export type ListingType = (typeof LISTING_TYPES)[number];

@Entity({ name: 'listings' })
export class Listing {
  @PrimaryColumn()
  id: string;

  @Column({ nullable: false })
  title: string;

  @Column({ nullable: true })
  description: string;

  @Column('json', { nullable: true })
  images: { url: string; id: string; position: number }[];

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  phone_number: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  date_of_birth: string;

  @Column({ nullable: true })
  is_vaccinated: boolean;

  @Column({ nullable: true })
  breed: string;

  @Column({ nullable: true })
  gender: 'male' | 'female' | 'unknown';

  @Column({ nullable: true, enum: Category })
  category: Category;

  @ManyToOne(() => User, (user) => user.listings, { onDelete: 'CASCADE' })
  user: User;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @Column('text', { array: true, nullable: true })
  interested_users: string[];

  @Column({ nullable: true, default: false })
  is_urgent: boolean;

  @Column({ nullable: true, default: false })
  is_adopted: boolean;

  @Column({ nullable: true, default: true })
  is_active: boolean;

  @Column({ nullable: true, default: 0 })
  number_of_interested_users: number;

  @Column({ nullable: true, default: 0, type: 'float' })
  size: number;

  @Column({ nullable: true, type: 'float' })
  lat: number;

  @Column({ nullable: true, type: 'float' })
  lng: number;

  @Column({ nullable: true })
  area_code: string;

  // 'adoption' = rehoming; 'lost' / 'found' = lost & found board. For lost/found,
  // is_adopted means "reunited" and event_date is when it was lost/found.
  @Column({ type: 'varchar', default: 'adoption' })
  listing_type: ListingType;

  @Column({ nullable: true, type: 'timestamptz' })
  event_date: Date | null;

  @Column({ nullable: true, type: 'text' })
  city: string | null;

  @Column({ nullable: true })
  is_sterilized: boolean;

  @Column({ nullable: true })
  is_microchipped: boolean;

  @Column({ nullable: true })
  good_with_kids: boolean;

  @Column({ nullable: true })
  good_with_dogs: boolean;

  @Column({ nullable: true })
  good_with_cats: boolean;

  @Column({ nullable: true, type: 'text' })
  medical_notes: string | null;

  // null = not stated, 0 = free.
  @Column({ nullable: true, type: 'float' })
  adoption_fee: number | null;

  @Column({ nullable: true, type: 'timestamptz' })
  adopted_at: Date | null;

  // Optional owner-written story shown on the success stories page.
  @Column({ nullable: true, type: 'text' })
  adoption_story: string | null;

  // Set by an admin (moderation) — distinct from is_active, which the owner controls.
  @Column({ default: false })
  is_hidden: boolean;
}
