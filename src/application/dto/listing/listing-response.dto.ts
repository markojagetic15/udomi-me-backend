import { Exclude } from 'class-transformer';
import { User } from '@domain/user/User.entity';

export class ListingResponseDto {
  id: string;
  title: string;
  description: string;
  images: { url: string; id: string }[];
  address: string;
  phone_number: string;
  email: string;
  created_at: Date;
  updated_at: Date;

  @Exclude()
  user: User;
}
