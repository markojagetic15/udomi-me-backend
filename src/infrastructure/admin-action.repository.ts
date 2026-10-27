import { AppDataSource } from '@config/data-source';
import { Injectable } from '@nestjs/common';
import { AdminAction } from '@domain/admin/AdminAction.entity';
import { dbCall } from '@shared/db-call';

@Injectable()
export class AdminActionRepository {
  private readonly actions = AppDataSource.getRepository(AdminAction);

  save(a: AdminAction): Promise<AdminAction> {
    return dbCall('saving admin action', () => this.actions.save(a));
  }

  findPage(
    take: number,
    skip: number,
    targetId?: string,
  ): Promise<[AdminAction[], number]> {
    return dbCall('finding admin actions', () =>
      this.actions.findAndCount({
        where: targetId ? { target_id: targetId } : {},
        relations: ['admin'],
        order: { created_at: 'DESC' },
        take,
        skip,
      }),
    );
  }
}
