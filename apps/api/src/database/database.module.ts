import { Module } from '@nestjs/common'
import { Pool } from 'pg'
import { PersistentCacheService, DB_POOL } from './persistent-cache.service'

@Module({
  providers: [
    {
      provide: DB_POOL,
      useFactory: () => {
        const connectionString = process.env.DATABASE_URL
        if (!connectionString) {
          throw new Error('DATABASE_URL environment variable is not set')
        }
        return new Pool({ connectionString })
      },
    },
    PersistentCacheService,
  ],
  exports: [PersistentCacheService],
})
export class DatabaseModule {}
