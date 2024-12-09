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

@Entity({ name: 'listings' })
export class Listing {
  @PrimaryColumn()
  id: string;

  @Column({ nullable: false })
  title: string;

  @Column({ nullable: true })
  description: string;

  @Column('json', { nullable: true })
  images: { url: string; id: string }[];

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
  gender: 'male' | 'female';

  @Column({ nullable: true })
  category: Category;

  @ManyToOne(() => User, (user) => user.listings, { onDelete: 'CASCADE' })
  user: User;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @Column({ nullable: true })
  interested_users: string[];

  @Column({ nullable: true })
  urgent: boolean;
}
