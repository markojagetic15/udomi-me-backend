import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'resources' })
export class ImageResource {
  @PrimaryColumn()
  id: string;

  @Column({ nullable: false })
  url: string;

  @Column({ nullable: false })
  title: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
