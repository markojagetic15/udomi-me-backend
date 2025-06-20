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

  @Column({ nullable: false })
  password: string;

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
}
