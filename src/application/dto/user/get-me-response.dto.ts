export class GetMeResponseDto {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  created_at: Date;
  avatar: string;
  favorite_listings: string[];
  listings: string[];
}
