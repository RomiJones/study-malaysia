import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { CompareItemEntity, UniversityEntity } from "../db/entities.js";
import { isReadyForPublicCatalog, mapUniversity } from "../common/mappers.js";

const MAX_COMPARE_ITEMS = 4;

@Injectable()
export class CompareService {
  private readonly compareRepository: Repository<CompareItemEntity>;
  private readonly universitiesRepository: Repository<UniversityEntity>;

  constructor(
    @InjectRepository(CompareItemEntity) compareRepository: Repository<CompareItemEntity>,
    @InjectRepository(UniversityEntity) universitiesRepository: Repository<UniversityEntity>
  ) {
    this.compareRepository = compareRepository;
    this.universitiesRepository = universitiesRepository;
  }

  async list(userId: number) {
    const items = await this.compareRepository.find({
      where: { userId },
      relations: { university: true },
      order: { sortOrder: "ASC", createdAt: "ASC" }
    });
    const universities = items
      .map((item) => item.university)
      .filter((university): university is UniversityEntity => Boolean(university))
      .filter(isReadyForPublicCatalog)
      .map(mapUniversity);

    return {
      universityIds: universities.map((university) => university.id),
      universities,
      maxItems: MAX_COMPARE_ITEMS
    };
  }

  async add(userId: number, universityId: number) {
    this.assertPositiveId(universityId, "University id is required");
    const university = await this.universitiesRepository.findOneBy({ id: universityId, isPublished: true, publicDisplayStatus: "ready" });
    if (!university) throw new NotFoundException("University not found");

    const existing = await this.compareRepository.findOne({ where: { userId, universityId } });
    if (existing) return this.list(userId);

    const current = await this.compareRepository.find({ where: { userId }, relations: { university: true }, order: { sortOrder: "ASC", createdAt: "ASC" } });
    const readyCount = current.filter((item) => item.university && isReadyForPublicCatalog(item.university)).length;
    if (readyCount >= MAX_COMPARE_ITEMS) {
      throw new BadRequestException(`Compare list supports up to ${MAX_COMPARE_ITEMS} universities`);
    }

    const nextSortOrder = current.reduce((max, item) => Math.max(max, item.sortOrder), -1) + 1;
    await this.compareRepository.save(this.compareRepository.create({ userId, universityId, sortOrder: nextSortOrder }));
    return this.list(userId);
  }

  async remove(userId: number, universityId: number) {
    this.assertPositiveId(universityId, "University id is required");
    const existing = await this.compareRepository.findOne({ where: { userId, universityId } });
    if (existing) {
      await this.compareRepository.remove(existing);
      await this.reorder(userId);
    }
    return this.list(userId);
  }

  async clear(userId: number) {
    const existing = await this.compareRepository.find({ where: { userId } });
    if (existing.length) {
      await this.compareRepository.remove(existing);
    }
    return this.list(userId);
  }

  async merge(userId: number, universityIds: number[] = []) {
    const normalizedIds = this.normalizeIds(universityIds);
    const universities = normalizedIds.length
      ? await this.universitiesRepository.findBy({ id: In(normalizedIds), isPublished: true, publicDisplayStatus: "ready" })
      : [];
    const validIds = new Set(universities.map((university) => university.id));
    const skippedUniversityIds = normalizedIds.filter((id) => !validIds.has(id));

    const current = await this.compareRepository.find({ where: { userId }, relations: { university: true }, order: { sortOrder: "ASC", createdAt: "ASC" } });
    const existingIds = new Set(current.map((item) => item.universityId));
    const readyCount = current.filter((item) => item.university && isReadyForPublicCatalog(item.university)).length;
    let nextSortOrder = current.reduce((max, item) => Math.max(max, item.sortOrder), -1) + 1;
    const additions: CompareItemEntity[] = [];

    for (const universityId of normalizedIds) {
      if (!validIds.has(universityId) || existingIds.has(universityId)) continue;
      if (readyCount + additions.length >= MAX_COMPARE_ITEMS) break;
      additions.push(this.compareRepository.create({ userId, universityId, sortOrder: nextSortOrder }));
      existingIds.add(universityId);
      nextSortOrder += 1;
    }

    if (additions.length) {
      await this.compareRepository.save(additions);
    }

    return {
      ...(await this.list(userId)),
      skippedUniversityIds,
      mergeStrategy: "server-first-union"
    };
  }

  private async reorder(userId: number) {
    const items = await this.compareRepository.find({ where: { userId }, order: { sortOrder: "ASC", createdAt: "ASC" } });
    await Promise.all(
      items.map((item, index) => {
        item.sortOrder = index;
        return this.compareRepository.save(item);
      })
    );
  }

  private normalizeIds(ids: number[]) {
    return Array.from(new Set(ids.map(Number).filter((id) => Number.isInteger(id) && id > 0)));
  }

  private assertPositiveId(id: number, message: string) {
    if (!Number.isInteger(id) || id <= 0) {
      throw new BadRequestException(message);
    }
  }
}
