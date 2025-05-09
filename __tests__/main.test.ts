/**
 * Unit tests for the action's main functionality, src/main.ts
 *
 * To mock dependencies in ESM, you can create fixtures that export mock
 * functions and objects. For example, the core module is mocked in this test,
 * so that the actual '@actions/core' module is not imported.
 */
import { jest } from '@jest/globals'
import * as core from '../__fixtures__/core.js'
import { existsSync } from 'fs'
import path from 'path'

// Mocks should be declared before the module being tested is imported.
jest.unstable_mockModule('@actions/core', () => core)

// The module being tested should be imported dynamically. This ensures that the
// mocks are used in place of any actual dependencies.
const { run } = await import('../src/main.js')

describe('main.ts', () => {
  beforeEach(() => {
    // Set the action's inputs as return values from core.getInput().
    core.getInput.mockImplementation((arg: string) => {
      if (arg === 'address') {
        return 'City Hall, New York'
      } else if (arg === 'zoom') {
        return '8'
      } else if (arg === 'output') {
        return './dist/generated-map.png'
      } else {
        throw new Error(`Unexpected input: ${arg}`)
      }
    })
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('Sets the time output', async () => {
    await run()

    // Verify the time output was set.
    const filePath = path.resolve('./dist/generated-maps.png')
    expect(existsSync(filePath)).toBe(true)
  })

  it('Sets a failed status', async () => {
    // Clear the getInput mock and return an invalid value.
    expect(() => core.getInput('foo')).toThrow('Unexpected input: foo')
    core.getInput.mockClear().mockReturnValue('invalid')
    await run()

    expect(core.setFailed).toHaveBeenNthCalledWith(
      1,
      'Invalid zoom level, must be a number'
    )
  })
})
