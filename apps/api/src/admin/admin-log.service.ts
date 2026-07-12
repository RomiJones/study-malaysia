import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { OperationLogEntity } from "../db/entities.js";
import type { AdminRequestUser } from "../common/guards.js";

@Injectable()
export class AdminLogService {
  private readonly logsRepository: Repository<OperationLogEntity>;

  constructor(@InjectRepository(OperationLogEntity) logsRepository: Repository<OperationLogEntity>) {
    this.logsRepository = logsRepository;
  }

  async write(
    adminUser: AdminRequestUser | null,
    module: string,
    action: string,
    targetType: string,
    targetId: string,
    summary: string,
    detail?: Record<string, unknown> | null
  ) {
    await this.logsRepository.save(
      this.logsRepository.create({
        adminUserId: adminUser?.id || null,
        module,
        action,
        targetType,
        targetId,
        summary,
        detail: detail || null,
        ip: "",
        userAgent: ""
      })
    );
  }
}
