import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, Not } from 'typeorm';
import { User } from './user.entity';
import { CreateUserDto, UpdateUserDto } from './users.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findAll(): Promise<User[]> {
    return this.userRepository.find();
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userRepository.findOneBy({ id });
    if (!user) {
      throw new NotFoundException(`User with ID <b>${id}</b> not found`);
    }
    return user;
  }

  // Fetch a user along with their associated projects
  async findOneWithProjects(id: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: {
        projects: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID <b>${id}</b> not found`);
    }
    return user;
  }

  async findByName(name: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { name: ILike(name.trim()) },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { email: ILike(email.trim()) },
    });
  }

  // Find user by either email OR name
  async findByIdentifier(identifier: string): Promise<User | null> {
    const clean = identifier.trim();
    return this.userRepository.findOne({
      where: [{ email: ILike(clean) }, { name: ILike(clean) }],
    });
  }

  async create(dto: CreateUserDto): Promise<User> {
    const trimmedEmail = dto.email.trim();
    const trimmedName = dto.name.trim();

    // 1. Check duplicate email
    const existingEmail = await this.userRepository.findOne({
      where: { email: ILike(trimmedEmail) },
    });
    if (existingEmail) {
      throw new ConflictException(
        `A user with the email <b>${trimmedEmail}</b> already exists. User creation was not performed.`,
      );
    }

    // 2. Check duplicate name
    const existingName = await this.userRepository.findOne({
      where: { name: ILike(trimmedName) },
    });
    if (existingName) {
      throw new ConflictException(
        `A user with the name <b>${trimmedName}</b> already exists. User creation was not performed.`,
      );
    }

    const user = this.userRepository.create({
      ...dto,
      name: trimmedName,
      email: trimmedEmail,
    });
    return this.userRepository.save(user);
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);

    // 1. Check duplicate email (excluding this user)
    if (dto.email) {
      const trimmedEmail = dto.email.trim();
      const conflictEmail = await this.userRepository.findOne({
        where: {
          email: ILike(trimmedEmail),
          id: Not(id),
        },
      });
      if (conflictEmail) {
        throw new ConflictException(
          `The identifier <b>${trimmedEmail}</b> is already associated with another user. The update was not performed.`,
        );
      }
      user.email = trimmedEmail;
    }

    // 2. Check duplicate name (excluding this user)
    if (dto.name) {
      const trimmedName = dto.name.trim();
      const conflictName = await this.userRepository.findOne({
        where: {
          name: ILike(trimmedName),
          id: Not(id),
        },
      });
      if (conflictName) {
        throw new ConflictException(
          `The identifier <b>${trimmedName}</b> is already associated with another user. The update was not performed.`,
        );
      }
      user.name = trimmedName;
    }

    if (dto.role) {
      user.role = dto.role.trim();
    }

    return this.userRepository.save(user);
  }

  // Update directly using identifier (name or email) passed from prompt
  async updateByIdentifier(
    identifier: string,
    dto: UpdateUserDto,
  ): Promise<User> {
    const cleanId = identifier.trim();
    const user = await this.findByIdentifier(cleanId);

    if (!user) {
      throw new NotFoundException(
        `User **${cleanId}** was not found in the system.`,
      );
    }

    // Update name if provided
    if (dto.name) {
      const trimmedName = dto.name.trim();
      const conflictName = await this.userRepository.findOne({
        where: {
          name: ILike(trimmedName),
          id: Not(user.id),
        },
      });
      if (conflictName) {
        throw new ConflictException(
          `A user with the name <b>${trimmedName}</b> already exists. The update was not performed.`,
        );
      }
      user.name = trimmedName;
    }

    // Update email if provided
    if (dto.email) {
      const trimmedEmail = dto.email.trim();
      const conflictEmail = await this.userRepository.findOne({
        where: {
          email: ILike(trimmedEmail),
          id: Not(user.id),
        },
      });
      if (conflictEmail) {
        throw new ConflictException(
          `A user with the email <b>${trimmedEmail}</b> already exists. The update was not performed.`,
        );
      }
      user.email = trimmedEmail;
    }

    if (dto.role) {
      user.role = dto.role.trim();
    }

    return this.userRepository.save(user);
  }

  async remove(id: string): Promise<{ id: string; deleted: boolean }> {
    const count = await this.userRepository.count();
    if (count <= 1) {
      throw new BadRequestException('Cannot delete the last user');
    }

    const user = await this.findOne(id);
    await this.userRepository.remove(user);

    return { id, deleted: true };
  }
}
