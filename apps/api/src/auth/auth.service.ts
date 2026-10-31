import { BadRequestException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import { compare, hash } from "bcryptjs";
import { Repository } from "typeorm";
import { SMART_RECOMMENDATION_REQUIRED_PROFILE_FIELDS, type AuthPayload, type AuthResponse } from "@studymy/shared";
import { PlannerProfileEntity, UserEntity } from "../db/entities.js";

@Injectable()
export class AuthService {
  private readonly usersRepository: Repository<UserEntity>;
  private readonly plannerProfileRepository: Repository<PlannerProfileEntity>;
  private readonly jwtService: JwtService;

  constructor(
    @InjectRepository(UserEntity) usersRepository: Repository<UserEntity>,
    @InjectRepository(PlannerProfileEntity) plannerProfileRepository: Repository<PlannerProfileEntity>,
    @Inject(JwtService) jwtService: JwtService
  ) {
    this.usersRepository = usersRepository;
    this.plannerProfileRepository = plannerProfileRepository;
    this.jwtService = jwtService;
  }

  async register(payload: AuthPayload): Promise<AuthResponse> {
    const existing = await this.usersRepository.findOne({ where: { account: payload.account } });
    if (existing) {
      throw new BadRequestException("Account already exists");
    }

    const user = await this.usersRepository.save(
      this.usersRepository.create({
        role: "student",
        method: payload.method,
        account: payload.account,
        displayName: payload.displayName || payload.account,
        passwordHash: await hash(payload.password, 10)
      })
    );

    await this.plannerProfileRepository.save(
      this.plannerProfileRepository.create({
        userId: user.id,
        profileVersion: 1,
        completenessStatus: "incomplete",
        requiredProfileFields: [...SMART_RECOMMENDATION_REQUIRED_PROFILE_FIELDS],
        missingProfileFields: [...SMART_RECOMMENDATION_REQUIRED_PROFILE_FIELDS],
        profileSnapshotHash: "",
        profileCompletedAt: null,
        recommendationRefreshedAt: null,
        materialProgress: {},
        visaChecklist: {
          offerAccepted: false,
          depositPaid: false,
          visaDocsReady: false,
          preDeparture: false,
          arrivalReady: false
        }
      })
    );

    return this.buildAuthResponse(user);
  }

  async login(payload: AuthPayload): Promise<AuthResponse> {
    const user = await this.usersRepository.findOne({ where: { account: payload.account } });
    if (!user || user.method !== payload.method) {
      throw new UnauthorizedException("Invalid account or method");
    }

    const matched = await compare(payload.password, user.passwordHash);
    if (!matched) {
      throw new UnauthorizedException("Invalid password");
    }

    return this.buildAuthResponse(user);
  }

  async me(userId: number) {
    const user = await this.usersRepository.findOneBy({ id: userId });
    if (!user) throw new UnauthorizedException("User not found");
    return {
      id: user.id,
      role: user.role,
      displayName: user.displayName,
      method: user.method,
      account: user.account
    };
  }

  private async buildAuthResponse(user: UserEntity): Promise<AuthResponse> {
    const accessToken = await this.jwtService.signAsync({ sub: user.id, role: user.role, tokenType: "student" });
    return {
      accessToken,
      user: {
        id: user.id,
        role: user.role,
        displayName: user.displayName,
        method: user.method,
        account: user.account
      }
    };
  }
}
