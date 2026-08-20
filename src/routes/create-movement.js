import Joi from 'joi'
import { HTTP_STATUS } from '@defra/waste-movement-utils'
import { handleCreateMovement } from '../handlers/create-movement.js'
import { badRequestResponseSchema } from '../schemas/bad-request-response-schema.js'
import { createMovementRequest } from '../schemas/generated-openapi-0-2-5-alpha.js'

const createMovement = {
  method: 'POST',
  path: '/movements',
  options: {
    tags: ['movements'],
    description: 'Endpoint to be used to create a waste collection',
    validate: {
      payload: createMovementRequest
    },
    plugins: {
      'hapi-swagger': {
        responses: {
          [HTTP_STATUS.CREATED]: {
            description: 'The waste movement has been created',
            schema: Joi.object({
              carrierMovementId: Joi.string().description(
                'An identifier of the movement, unique for the carrier only. This field will only be returned if the carrier is known to the service and should be provided to the carrier by the receiver.'
              ),
              wasteTrackingId: Joi.string()
                .uuid()
                .description(
                  'Globally unique identifier of the movement. This id should be stored and used for any subsequent updates of the movement.'
                )
            })
          },
          [HTTP_STATUS.BAD_REQUEST]: {
            description: 'Input was not in the correct format.',
            schema: badRequestResponseSchema
          },
          [HTTP_STATUS.FORBIDDEN]: {
            description: 'The client is not authorized to create movements.',
            schema: Joi.object({
              error: Joi.string(),
              message: Joi.string()
            })
          }
        }
      }
    }
  },
  handler: handleCreateMovement
}

export { createMovement }
