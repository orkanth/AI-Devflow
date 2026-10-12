
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
} from 'typeorm';

@Entity('knowledge_chunks')
export class KnowledgeChunkEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'document_id', type: 'uuid' })
  documentId: string;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ name: 'chunk_index', type: 'integer', default: 0 })
  chunkIndex: number;

  @Column({
    type: 'vector',
    length: 1536,
    nullable: true,
  })
  embedding: number[] | null; 
  @Column({
    name: 'created_at',
    type: 'timestamptz',
    default: () => 'NOW()',
  })
  createdAt: Date;
  
}
