import { describe, it, expect } from 'vitest'
import pkg from '../package.json' with { type: 'json' }

describe('package.json exports', () => {
  type ExportPath = '.' | './schemas' | './fixtures' | './trpc'
  const exportPaths: ExportPath[] = ['.', './schemas', './fixtures', './trpc']

  it.each(exportPaths)('exports %s with both import and require conditions', (path) => {
    const exp = pkg.exports[path]
    expect(exp).toBeDefined()
    expect(exp.import).toBeDefined()
    expect(exp.require).toBeDefined()
    expect(exp.types).toBeDefined()
  })

  it('exports . with valid file paths', () => {
    expect(pkg.exports['.'].import).toBe('./dist/index.js')
    expect(pkg.exports['.'].require).toBe('./dist/index.js')
    expect(pkg.exports['.'].types).toBe('./dist/index.d.ts')
  })
})
