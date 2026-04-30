export class GetMeResponseDto {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  created_at: Date;
  avatar: string;
  favorite_listings: { id: string }[];
  interested_listings: { id: string }[];
  listings: { id: string }[];
}
