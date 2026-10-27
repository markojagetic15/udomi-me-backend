import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { User } from '../user/User.entity';
import { ListingFilters } from '../listing/listing-filters';

// A browse filter set the user wants alerts for; matched against every new
// listing in NotificationService.notifySavedSearches.
@Entity({ name: 'saved_searches' })
export class SavedSearch {
  @PrimaryColumn()
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column({ type: 'text' })
  name: string;

  @Column('json')
  filters: ListingFilters;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
