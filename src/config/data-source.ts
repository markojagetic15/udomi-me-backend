import { DataSource } from 'typeorm';
import { User } from '@/domain/user/User.entity';
import { Listing } from '@/domain/listing/Listing.entity';
import { ImageResource } from '@/domain/resource/ImageResource.entity';
import { PasswordResetToken } from '@/domain/auth/PasswordResetToken.entity';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: 5432,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: 'postgres',
  synchronize: true,
  logging: true,
  entities: [User, Listing, ImageResource, PasswordResetToken],
});
