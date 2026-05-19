import { Test } from '@nestjs/testing'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AppModule } from './app.module'

describe('AppModule', () => {
  beforeEach(() => {
    vi.stubEnv('DATABASE_URL', 'postgresql://test:test@localhost:5432/test')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('compiles successfully', async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()
    expect(module).toBeDefined()
  })
})
