import { Column, Entity } from 'typeorm';

@Entity({
  name: 'password_reset_tokens',
})
export class PasswordResetToken {
  @Column()
  token: string;

  @Column()
  userId: string;

  @Column()
  expiration: Date;
}
