import { jest } from '@jest/globals'
import { httpClients } from '../common/helpers/http-client.js'
import { handleCreateMovement } from './create-movement.js'
import { v4 as uuidv4 } from 'uuid'

// Mock the httpClients
jest.mock('../common/helpers/http-client.js', () => ({
  httpClients: {
    wasteMovement: {
      post: jest.fn()
    }
  }
}))

describe('Create Movement Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const validPayload = {
    apiCode: uuidv4(),
    receiverReference: 'ref123',
    specialHandlingRequirements: 'Handle with care',
    wasteItems: [
      {
        ewcCodes: ['200101'],
        wasteDescription: 'Test waste',
        physicalForm: 'Solid',
        numberOfContainers: 1,
        typeOfContainers: 'SKI',
        weight: {
          metric: 'Tonnes',
          amount: 1.0,
          isEstimate: false
        },
        containsPops: false,
        containsHazardous: false,
        pops: {},
        hazardous: {},
        disposalOrRecoveryCodes: [
          {
            code: 'R1',
            weight: {
              metric: 'Tonnes',
              amount: 10,
              isEstimate: false
            }
          }
        ]
      }
    ],
    carrier: {
      name: 'Test Carrier',
      address: {
        street: '123 Test St',
        city: 'Test City',
        postcode: 'TE1 1ST'
      }
    }
  }

  const request = {
    auth: {
      credentials: {
        clientId: 'test-client-id'
      }
    },
    payload: validPayload
  }

  it('should successfully create a waste movement', async () => {
    // Mock successful waste movement creation
    httpClients.wasteMovement.post.mockResolvedValue({
      statusCode: 201,
      body: { id: 'movementId' }
    })

    const h = {
      response: jest.fn().mockReturnThis(),
      code: jest.fn().mockReturnThis()
    }

    await handleCreateMovement(request, h)

    expect(h.response).toHaveBeenCalledWith({
      statusCode: 201,
      body: { movementId: 'movementId' }
    })

    expect(httpClients.wasteMovement.post).toHaveBeenCalledWith(
      `/movements`,
      validPayload
    )
  })

  it('should return 500 when waste movement creation fails', async () => {
    httpClients.wasteMovement.post.mockRejectedValue(new Error('API Error'))

    const h = {
      response: jest.fn().mockReturnThis(),
      code: jest.fn().mockReturnThis()
    }

    await handleCreateMovement(request, h)

    expect(h.response).toHaveBeenCalledWith({
      error: 'Internal Server Error',
      message: 'Failed to create waste movement'
    })
    expect(h.code).toHaveBeenCalledWith(500)
  })
})
