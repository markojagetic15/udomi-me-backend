import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';

export class encrypt {
  static async encryptpass(password: string) {
    return bcrypt.hashSync(password, 12);
  }

  static comparepassword(hashPassword: string, password: string) {
    return bcrypt.compareSync(password, hashPassword);
  }

  static generateToken(payload: { id: string }) {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET environment variable is not set');
    return jwt.sign(payload, secret, { expiresIn: '1d' });
  }
}
