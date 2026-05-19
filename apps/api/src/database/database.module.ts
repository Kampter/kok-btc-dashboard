import { Module, Logger } from '@nestjs/common'
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
        const pool = new Pool({ connectionString })
        pool.on('error', (err) => {
          Logger.error(`Unexpected PostgreSQL pool error: ${err.message}`, err.stack, 'DatabaseModule')
        })
        return pool
      },
    },
    PersistentCacheService,
  ],
  exports: [PersistentCacheService],
})
export class DatabaseModule {}
