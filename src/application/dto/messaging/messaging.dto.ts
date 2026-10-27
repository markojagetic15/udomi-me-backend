import { IsString, IsUUID, Length } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @Length(1, 2000)
  body: string;
}

export class StartConversationDto extends SendMessageDto {
  @IsUUID()
  listing_id: string;
}
