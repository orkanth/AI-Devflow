import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description?: string;

  // Make ownerId optional
  @Column({ type: 'uuid', nullable: true })
  ownerId?: string | null;

  // Set onDelete to SET NULL and allow null
  @ManyToOne(() => User, (user) => user.projects, { 
    onDelete: 'SET NULL', 
    nullable: true 
  })
  @JoinColumn({ name: 'ownerId' })
  owner?: User | null;

  @Column({ default: 'active' })
  status: string;

  @Column({ default: 'medium' })
  priority: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}