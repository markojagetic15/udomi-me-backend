import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { Listing } from '../listing/Listing.entity';

@Entity({ name: 'users' })
export class User {
  @PrimaryColumn()
  id: string;

  @Column({ nullable: false })
  first_name: string;

  @Column({ nullable: false })
  last_name: string;

  @Column({ nullable: false, unique: true })
  email: string;

  @Column({ nullable: true, default: '' })
  password: string;

  @Column({ nullable: true, default: false })
  is_verified: boolean;

  @Column({ nullable: true, type: 'text' })
  verification_token: string;

  // 'admin' is granted at runtime from ADMIN_EMAILS (see UserService.getMe) or
  // set directly in the DB.
  @Column({ type: 'varchar', default: 'user' })
  role: 'user' | 'admin';

  @Column({ default: false })
  is_banned: boolean;

  @Column({ type: 'varchar', default: 'hr' })
  language: 'hr' | 'en';

  @Column({ default: true })
  email_notifications: boolean;
  @Column({ nullable: true, type: 'text' })
  avatar_url: string | null;

  // Shelter / rescue organisation profile. account_type flips to 'shelter' when
  // the user applies; shelter_status is moderated by an admin.
  @Column({ type: 'varchar', default: 'individual' })
  account_type: 'individual' | 'shelter';

  @Column({ type: 'varchar', default: 'none' })
  shelter_status: 'none' | 'pending' | 'verified' | 'rejected';

  @Column({ nullable: true, type: 'text' })
  shelter_name: string | null;

  @Column({ nullable: true, type: 'text' })
  shelter_description: string | null;

  @Column({ nullable: true, type: 'text' })
  shelter_city: string | null;

  @Column({ nullable: true, type: 'text' })
  shelter_website: string | null;

  @Column({ nullable: true, type: 'text' })
  shelter_phone: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @OneToMany(() => Listing, (listing) => listing.user)
  listings: Listing[];

  @ManyToMany(() => Listing)
  @JoinTable({ name: 'user_favorite_listings' })
  favorite_listings: Listing[];

  @ManyToMany(() => Listing)
  @JoinTable({ name: 'user_interested_listings' })
  interested_listings: Listing[];

  // Strips secrets from every HTTP response (res.json → JSON.stringify calls
  // this), including users nested in listings. Services still read the real
  // fields in memory.
  toJSON() {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, verification_token, ...rest } = this;
    return rest;
  }
}
