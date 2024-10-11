import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({
  name: 'password_reset_tokens',
})
export class PasswordResetToken {
  @PrimaryColumn()
  token: string;

  @Column()
  userId: string;

  @Column()
  expiration: Date;
}
