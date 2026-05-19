import { Test } from '@nestjs/testing'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { AppModule } from './app.module'

describe('AppModule', () => {
  const originalDatabaseUrl = process.env.DATABASE_URL

  beforeAll(() => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
  })

  afterAll(() => {
    process.env.DATABASE_URL = originalDatabaseUrl
  })

  it('compiles successfully', async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()
    expect(module).toBeDefined()
  })
})
