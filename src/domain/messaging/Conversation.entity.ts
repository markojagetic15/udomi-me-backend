import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  Unique,
} from 'typeorm';
import { Listing } from '../listing/Listing.entity';
import { User } from '../user/User.entity';
import { Message } from './Message.entity';

// One thread per (listing, interested user). `owner` is the listing owner at
// the time the thread started; `participant` is the person who reached out.
@Entity({ name: 'conversations' })
@Unique(['listing', 'participant'])
export class Conversation {
  @PrimaryColumn()
  id: string;

  @ManyToOne(() => Listing, { onDelete: 'SET NULL', nullable: true })
  listing: Listing | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  owner: User;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  participant: User;

  @OneToMany(() => Message, (m) => m.conversation)
  messages: Message[];

  @Column({ type: 'timestamptz' })
  last_message_at: Date;

  @Column({ nullable: true, type: 'text' })
  last_message_preview: string | null;

  @Column({ nullable: true, type: 'timestamptz' })
  owner_last_read_at: Date | null;

  @Column({ nullable: true, type: 'timestamptz' })
  participant_last_read_at: Date | null;

  // Thread started by an admin "as the Udomi me team" (no listing); shown
  // with an official badge. One per (admin, user), reused for later messages.
  @Column({ default: false })
  is_support: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
