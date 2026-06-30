import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { TuitionCurrency } from "@studymy/shared";
import { Repository } from "typeorm";
import { mapProgram, mapUniversity } from "../common/mappers.js";
import { resolveProgramFee } from "../common/fee-strategy.helper.js";
import { ProgramEntity, UniversityEntity } from "../db/entities.js";

export interface CostEstimateInput {
  programId?: number;
  tuition?: number;
  currency?: TuitionCurrency;
  duration?: number;
  durationYears?: number;
  livingCost?: number;
  miscCost?: number;
}

type CostEstimateCurrency = Exclude<TuitionCurrency, "UNKNOWN">;

function hasNumber(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function assertNonNegative(value: number | undefined, fieldName: string): void {
  if (hasNumber(value) && value < 0) {
    throw new BadRequestException(`${fieldName} must be greater than or equal to 0`);
  }
}

function normalizeDuration(value: number | undefined, fallback: number): number {
  if (!hasNumber(value)) return Math.max(1, fallback || 1);
  if (value <= 0) {
    throw new BadRequestException("duration must be greater than 0");
  }
  return value;
}

@Injectable()
export class ToolsService {
  constructor(
    @InjectRepository(ProgramEntity) private readonly programsRepository: Repository<ProgramEntity>,
    @InjectRepository(UniversityEntity) private readonly universitiesRepository: Repository<UniversityEntity>
  ) {}

  async costEstimate(input: CostEstimateInput) {
    assertNonNegative(input.tuition, "tuition");
    assertNonNegative(input.livingCost, "livingCost");
    assertNonNegative(input.miscCost, "miscCost");

    const program = input.programId
      ? await this.programsRepository.findOne({
          where: { id: input.programId, isPublished: true, publicDisplayStatus: "ready" }
        })
      : null;
    if (input.programId && !program) {
      throw new NotFoundException("Program not found");
    }

    const university = program
      ? await this.universitiesRepository.findOneBy({ id: program.universityId, isPublished: true, publicDisplayStatus: "ready" })
      : null;
    if (program && !university) {
      throw new NotFoundException("University not found");
    }

    const durationYears = normalizeDuration(input.durationYears ?? input.duration, Number(program?.durationYears || 1));
    const feeResolution = program ? resolveProgramFee(program) : null;
    const officialTuitionMYR = program?.officialTuitionMYR ?? null;
    const programmeTotal = program?.tuitionAmount == null ? null : Number(program.tuitionAmount);
    const hasTrustedProgramFee = Boolean(program && feeResolution?.hasVerifiedFee);
    const usesProgrammeTotal = hasTrustedProgramFee && (officialTuitionMYR != null || programmeTotal != null);
    const currency: CostEstimateCurrency = hasTrustedProgramFee && officialTuitionMYR != null
      ? "MYR"
      : usesProgrammeTotal
        ? ((program?.tuitionCurrency && program.tuitionCurrency !== "UNKNOWN" ? program.tuitionCurrency : "CNY") as CostEstimateCurrency)
        : ((input.currency && input.currency !== "UNKNOWN" ? input.currency : "CNY") as CostEstimateCurrency);
    const tuitionBasis = usesProgrammeTotal
      ? (officialTuitionMYR ?? programmeTotal ?? undefined)
      : hasTrustedProgramFee
        ? (feeResolution?.filterableTuitionCny ?? input.tuition)
        : input.tuition;

    if (!hasNumber(tuitionBasis)) {
      throw new BadRequestException("tuition or programId is required");
    }

    const tuitionTotal = usesProgrammeTotal ? Math.round(tuitionBasis) : Math.round(tuitionBasis * durationYears);
    const livingAnnual = input.livingCost ?? (currency === "CNY" && university ? university.livingCostCny : 0);
    const livingTotal = Math.round(livingAnnual * durationYears);
    const miscTotal = Math.round(input.miscCost ?? 0);
    const total = tuitionTotal + livingTotal + miscTotal;

    return {
      total,
      currency,
      durationYears,
      tuitionTotal,
      livingTotal,
      miscTotal,
      grandTotal: total,
      breakdown: [
        {
          key: "tuition",
          label: "Tuition",
          amount: tuitionTotal,
          source: usesProgrammeTotal ? "official-program-total" : hasTrustedProgramFee ? "program-filterable-annual-tuition" : "manual-input"
        },
        {
          key: "livingCost",
          label: "Living cost",
          amount: livingTotal,
          source: input.livingCost != null ? "manual-input" : currency === "CNY" && university ? "university-living-cost" : "not-included"
        },
        {
          key: "miscCost",
          label: "Miscellaneous cost",
          amount: miscTotal,
          source: input.miscCost != null ? "manual-input" : "not-included"
        }
      ],
      source: {
        programId: program?.id ?? null,
        universityId: university?.id ?? null,
        tuitionSource: hasTrustedProgramFee && officialTuitionMYR != null
          ? "official-myr-total"
          : usesProgrammeTotal && programmeTotal != null
            ? "official-program-total"
            : hasTrustedProgramFee
              ? "program-filterable-annual-cny"
              : "manual-input",
        officialTuitionMYR,
        officialFeeSourceUrl: program?.officialFeeSourceUrl || null,
        officialFeeAuditStatus: program?.officialFeeAuditStatus || null,
        officialSourceStatus: program?.officialSourceStatus || null
      },
      university: university ? mapUniversity(university) : null,
      program: program ? mapProgram(program) : null
    };
  }
}
