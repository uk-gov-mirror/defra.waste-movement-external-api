import { httpClients } from '../common/helpers/http-client.js'
import { HTTP_STATUS } from '@defra/waste-movement-utils'
import { handleBackendResponse } from './handle-backend-response.js'
import { createLogger } from '../common/helpers/logging/logger.js'
import { isSuccessStatusCode } from '../common/helpers/utils.js'

const logger = createLogger()

export const handleCreateMovement = async (request, h) => {
  try {
    const requestData = request.payload
    const backendResponse = await httpClients.wasteMovement.post(
      '/movements',
      requestData
    )
    const isSuccess = isSuccessStatusCode(backendResponse.statusCode)

    const response = {
      body: { movementId: backendResponse?.body?.id },
      statusCode: isSuccess ? HTTP_STATUS.CREATED : backendResponse.statusCode
    }

    logger.info(`Successfully created waste movement with id ${response.id}`)

    return handleBackendResponse(response, h, () => response)
  } catch (error) {
    logger.error({ err: error }, 'Error creating waste movement')
    return h
      .response({
        error: 'Internal Server Error',
        message: 'Failed to create waste movement'
      })
      .code(HTTP_STATUS.INTERNAL_SERVER_ERROR)
  }
}
