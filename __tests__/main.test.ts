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
import { verifyJSON } from '../src/main'
import path from 'path'

// Mocks should be declared before the module being tested is imported.
jest.unstable_mockModule('@actions/core', () => core)

describe('main.ts', () => {
  const env = process.env
  beforeEach(() => {
    jest.resetModules()
    // Set the action's inputs as return values from core.getInput().
    core.getInput.mockImplementation((arg: string) => {
      if (arg === 'address') {
        return 'City Hall, New York'
      } else if (arg === 'zoom') {
        return '8'
      } else if (arg === 'output') {
        return './dist/generated-map.png'
      } else if (
        arg === 'google_static_map_api_key' &&
        process.env.MAPS_API_KEY
      ) {
        return process.env.MAPS_API_KEY
      } else {
        throw new Error(`Unexpected input: ${arg}`)
      }
    })
    process.env = { ...env }
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('Able to generate valid map', async () => {
    // Dynamically import the module to test to load the env variable.
    const { run } = await import('../src/main.js')
    await run()

    // Verify that the map
    const filePath = path.resolve('./dist/generated-map.png')
    expect(existsSync(filePath)).toBe(true)
  })

  it('Invalid zoom input', async () => {
    const { run } = await import('../src/main.js')
    // Clear the getInput mock and return an invalid value.
    expect(() => core.getInput('foo')).toThrow('Unexpected input: foo')
    core.getInput.mockClear().mockReturnValue('invalid')
    await run()

    expect(core.setFailed).toHaveBeenNthCalledWith(
      1,
      'Invalid zoom level, must be a number'
    )
  })

  it('Invalid api key', async () => {
    const { run } = await import('../src/main.js')
    // Clear the getInput mock
    core.getInput.mockClear().mockImplementation((arg: string) => {
      const keys = ['address', 'zoom', 'output', 'google_static_map_api_key']
      if (!keys.includes(arg)) {
        throw new Error(`Unexpected input: ${arg}`)
      }
      const failedInputs = {
        address: 'City Hall, New York',
        zoom: '8',
        output: './dist/generated-map.png',
        google_static_map_api_key: '114514'
      }
      return failedInputs[arg as keyof typeof failedInputs]
    })
    await run()
    expect(core.setFailed).toHaveBeenNthCalledWith(1, 'Invalid PNG image')
  })
})

describe('verifyJSON Function Tests', () => {
  it('Invalid Style config', async () => {
    const failedJSON = `{
        "featureType": "all",
        "elementType": "labels",
        "stylers": [
          {
            "visibility": "okk"
          }
        ]}`
    const failedObject = JSON.parse(failedJSON)
    expect(() => verifyJSON(failedObject)).toThrow('Invalid visibility value')
  })

  it('Invalid Style format', async () => {
    const failedJSON = `{
        "featureType": "all",
        "elementType": "labels",
        "stylers":
          {
            "visibility": "on"
          }
        }`
    const failedObject = JSON.parse(failedJSON)
    expect(() => verifyJSON(failedObject)).toThrow('Invalid stylers')
  })

  it('Invalid JSON property', async () => {
    const failedJSON = `{
        "mapType": "all",
        "elementType": "labels",
        "stylers":
          [{
            "visibility": "on"
        }]
        }`
    const failedObject = JSON.parse(failedJSON)
    expect(() => verifyJSON(failedObject)).toThrow('Invalid JSON property')
  })
})
