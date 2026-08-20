import Joi from 'joi'

// -----------------------------------------------------------------------------
// Shared primitives
// -----------------------------------------------------------------------------

const uuid = Joi.string().guid()
const isoDateTime = Joi.string().isoDate()

const meansOfTransport = Joi.string().valid(
  'Road',
  'Rail',
  'Air',
  'Sea',
  'Inland Waterway',
  'Piped',
  'Other'
)

const registrationNumberReason = Joi.string().valid(
  'ON_SITE',
  'HOUSEHOLD',
  'ONE_OFF',
  'MARINE'
)

const componentSource = Joi.string().valid(
  'NOT_PROVIDED',
  'PROVIDED_WITH_WASTE',
  'GUIDANCE',
  'OWN_TESTING'
)

const weight = Joi.object({
  metric: Joi.string().valid('Grams', 'Kilograms', 'Tonnes').required(),

  amount: Joi.number().greater(0).required(),

  isEstimate: Joi.boolean().required()
})

const movementId = Joi.string()
const transferId = Joi.string()

const wasteTrackingId = Joi.string().pattern(/^[A-Z]{2}[A-Z0-9]{6}$/)

// -----------------------------------------------------------------------------
// Addresses
// -----------------------------------------------------------------------------

const address = Joi.object({
  fullAddress: Joi.string(),
  postcode: Joi.string().required()
})

const addressWithFullAddress = Joi.object({
  fullAddress: Joi.string().required(),
  postcode: Joi.string().required()
})

const receiptAddress = Joi.object({
  fullAddress: Joi.string().required(),
  postcode: Joi.string().required()
})

// -----------------------------------------------------------------------------
// Small reusable objects
// -----------------------------------------------------------------------------

const otherReferenceForMovement = Joi.object({
  label: Joi.string().min(1).required(),
  reference: Joi.string().min(1).required()
})

const validationResult = Joi.object({
  key: Joi.string(),
  errorType: Joi.string().valid(
    'NotProvided',
    'NotAllowed',
    'InvalidType',
    'InvalidFormat',
    'InvalidValue',
    'OutOfRange',
    'BusinessRuleViolation'
  ),
  message: Joi.string()
})

const validationEnvelope = Joi.object({
  warnings: Joi.array().items(validationResult)
})

const validationErrorEnvelope = Joi.object({
  errors: Joi.array().items(validationResult)
})

// -----------------------------------------------------------------------------
// Organisation
// -----------------------------------------------------------------------------

const organisation = Joi.object({
  organisationName: Joi.string().required(),
  registrationNumber: Joi.string(),
  permitNumber: Joi.string(),
  address
})

// -----------------------------------------------------------------------------
// Treatment
// -----------------------------------------------------------------------------

const disposalOrRecoveryCode = Joi.object({
  code: Joi.string().required(),
  weight: weight.required()
})

// -----------------------------------------------------------------------------
// Producer
// -----------------------------------------------------------------------------

const producerDetails = Joi.object({
  wasteSource: Joi.string()
    .valid('Household', 'Commercial', 'Municipal')
    .required(),

  organisationName: Joi.string(),
  authorisationNumber: Joi.string(),

  sicCode: Joi.string().pattern(/^\d{5}$/),

  emailAddress: Joi.string().email(),
  phoneNumber: Joi.string(),

  address: address.required(),

  councilMovement: Joi.boolean().required()
})
  // Commercial: business identity is mandatory.
  .when('wasteSource', {
    is: 'Commercial',
    then: Joi.object({
      organisationName: Joi.string().required(),
      authorisationNumber: Joi.string().required(),
      sicCode: Joi.string()
        .pattern(/^\d{5}$/)
        .required()
    })
  })
  // Household: business-only fields are forbidden.
  .when('wasteSource', {
    is: 'Household',
    then: Joi.object({
      organisationName: Joi.forbidden(),
      authorisationNumber: Joi.forbidden(),
      sicCode: Joi.forbidden(),
      emailAddress: Joi.forbidden(),
      phoneNumber: Joi.forbidden()
    })
  })

// -----------------------------------------------------------------------------
// Carrier
// -----------------------------------------------------------------------------

const carrierBase = Joi.object({
  registrationNumber: Joi.string().allow(null, ''),

  reasonForNoRegistrationNumber: registrationNumberReason,

  organisationName: Joi.string(),

  address,

  emailAddress: Joi.string().email(),

  phoneNumber: Joi.string(),

  vehicleRegistration: Joi.string().max(10),

  meansOfTransport: meansOfTransport.required()
})

/**
 * Rules common to creation and full carrier shapes.
 *
 * These are deliberately object-level rules rather than duplicated
 * `.when()` expressions because they describe relationships between fields.
 */
const carrierRules = (schema) =>
  schema.custom((value, helpers) => {
    const {
      registrationNumber,
      reasonForNoRegistrationNumber,
      meansOfTransport,
      vehicleRegistration
    } = value

    const hasRegistration =
      registrationNumber !== undefined &&
      registrationNumber !== null &&
      registrationNumber !== ''

    const hasNoRegistrationReason = reasonForNoRegistrationNumber !== undefined

    if (hasRegistration && hasNoRegistrationReason) {
      return helpers.error('any.invalid', {
        message:
          'registrationNumber and reasonForNoRegistrationNumber are mutually exclusive'
      })
    }

    if (!hasRegistration && !hasNoRegistrationReason) {
      return helpers.error('any.invalid', {
        message:
          'reasonForNoRegistrationNumber is required when registrationNumber is not supplied'
      })
    }

    if (meansOfTransport === 'Road' && !vehicleRegistration) {
      return helpers.error('any.invalid', {
        message: 'vehicleRegistration is required when meansOfTransport is Road'
      })
    }

    if (meansOfTransport !== 'Road' && vehicleRegistration !== undefined) {
      return helpers.error('any.invalid', {
        message:
          'vehicleRegistration is only valid when meansOfTransport is Road'
      })
    }

    return value
  })

/**
 * Creation is deliberately less restrictive:
 * only meansOfTransport is structurally required by the OpenAPI document.
 */
const creationCarrierDetails = carrierRules(
  carrierBase.fork(
    [
      'registrationNumber',
      'reasonForNoRegistrationNumber',
      'organisationName',
      'address',
      'emailAddress',
      'phoneNumber',
      'vehicleRegistration'
    ],
    (schema) => schema.optional()
  )
).when('meansOfTransport', {
  is: 'Other',
  then: Joi.object({
    otherMeansOfTransport: Joi.string()
  }),
  otherwise: Joi.object({
    otherMeansOfTransport: Joi.forbidden()
  })
})

/**
 * Full carrier used by Collection, Drop-off and Phase 1 Receipt.
 */
const carrier = carrierRules(
  carrierBase.keys({
    registrationNumber: Joi.string().allow(null, '').required(),

    organisationName: Joi.string().required(),

    vehicleRegistration: Joi.string().max(10),

    meansOfTransport: meansOfTransport.required()
  })
)

// -----------------------------------------------------------------------------
// Broker / Dealer
// -----------------------------------------------------------------------------

const brokerOrDealer = Joi.object({
  organisationName: Joi.string().required(),
  address,
  emailAddress: Joi.string().email(),
  phoneNumber: Joi.string(),
  registrationNumber: Joi.string()
})

// -----------------------------------------------------------------------------
// Receiver
// -----------------------------------------------------------------------------

const receiver = Joi.object({
  siteName: Joi.string().required(),
  emailAddress: Joi.string(),
  phoneNumber: Joi.string(),
  authorisationNumber: Joi.string().required(),
  regulatoryPositionStatements: Joi.array().items(
    Joi.number().integer().greater(0)
  )
})

/**
 * Receiver supplied at Movement creation is intentionally a different,
 * less authoritative shape from the Phase 1 receiver.
 */
const creationReceiverDetails = Joi.object({
  siteName: Joi.string(),
  authorisationNumber: Joi.string(),
  emailAddress: Joi.string().email(),
  phoneNumber: Joi.string(),
  address
}).when('siteName', {
  is: Joi.exist(),
  then: Joi.object({
    authorisationNumber: Joi.string().required(),
    address: addressWithFullAddress.required()
  })
})

// -----------------------------------------------------------------------------
// Collection / Drop-off sites
// -----------------------------------------------------------------------------

const collectionSite = Joi.object({
  address: addressWithFullAddress.required()
})

const dropOffSite = Joi.object({
  siteName: Joi.string().required(),
  exemptionNumber: Joi.string(),
  address: addressWithFullAddress.required()
})

const driverDetails = Joi.object({
  name: Joi.string()
})

const receipt = Joi.object({
  address: receiptAddress.required()
})

// -----------------------------------------------------------------------------
// POPs
// -----------------------------------------------------------------------------

const popComponent = Joi.object({
  code: Joi.string().required(),
  concentration: Joi.number().greater(0)
})

const pops = Joi.object({
  sourceOfComponents: componentSource.required(),

  components: Joi.array().items(popComponent)
}).custom((value, helpers) => {
  const components = value.components

  switch (value.sourceOfComponents) {
    case 'NOT_PROVIDED':
      if (components && components.length > 0) {
        return helpers.error('any.invalid', {
          message:
            'components must be empty when sourceOfComponents is NOT_PROVIDED'
        })
      }
      break

    case 'GUIDANCE':
    case 'OWN_TESTING':
      if (!components || components.length === 0) {
        return helpers.error('any.invalid', {
          message: 'components are required for GUIDANCE or OWN_TESTING'
        })
      }
      break

    case 'PROVIDED_WITH_WASTE':
      // Empty/missing is permitted by the API, but may generate a warning.
      break
  }

  return value
})

// -----------------------------------------------------------------------------
// Hazardous waste
// -----------------------------------------------------------------------------

const hazardousComponent = Joi.object({
  name: Joi.string().required(),
  concentration: Joi.number().greater(0)
})

const hazardous = Joi.object({
  sourceOfComponents: componentSource.required(),

  hazCodes: Joi.array().items(Joi.string()),

  components: Joi.array().items(hazardousComponent)
}).custom((value, helpers) => {
  const components = value.components

  switch (value.sourceOfComponents) {
    case 'NOT_PROVIDED':
      if (components && components.length > 0) {
        return helpers.error('any.invalid', {
          message:
            'components must be empty when sourceOfComponents is NOT_PROVIDED'
        })
      }
      break

    case 'GUIDANCE':
    case 'OWN_TESTING':
      if (!components || components.length === 0) {
        return helpers.error('any.invalid', {
          message: 'components are required for GUIDANCE or OWN_TESTING'
        })
      }
      break

    case 'PROVIDED_WITH_WASTE':
      // Permitted; absence/empty array may result in a warning.
      break
  }

  return value
})

// -----------------------------------------------------------------------------
// Waste item
// -----------------------------------------------------------------------------

const wasteItem = Joi.object({
  ewcCodes: Joi.array().items(Joi.string()).min(1).max(5).required(),

  wasteDescription: Joi.string().required(),

  physicalForm: Joi.string()
    .valid('Gas', 'Liquid', 'Solid', 'Powder', 'Sludge', 'Mixed')
    .required(),

  typeOfContainers: Joi.string().required(),

  numberOfContainers: Joi.number().integer().min(0).required(),

  weight: weight.required(),

  containsPops: Joi.boolean().required(),

  pops,

  containsHazardous: Joi.boolean().required(),

  hazardous,

  disposalOrRecoveryCodes: Joi.array().items(disposalOrRecoveryCode)
})
  // POP details are conditional on containsPops.
  .when('containsPops', {
    is: true,
    then: Joi.object({
      pops: pops.required()
    }),
    otherwise: Joi.object({
      pops: Joi.forbidden()
    })
  })
  // Hazardous details are conditional on containsHazardous.
  .when('containsHazardous', {
    is: true,
    then: Joi.object({
      hazardous: hazardous.required()
    }),
    otherwise: Joi.object({
      hazardous: Joi.forbidden()
    })
  })

// -----------------------------------------------------------------------------
// Movement creation
// -----------------------------------------------------------------------------

const createMovementRequest = Joi.object({
  apiCode: uuid.required(),

  estimatedDateTimeCollected: isoDateTime.required(),

  hazardousWasteConsignmentCode: Joi.string(),

  reasonForNoConsignmentCode: Joi.string().valid(
    'NON_HAZ_WASTE_TRANSFER',
    'NO_DOC_WITH_WASTE',
    'HWRC_RECEIPT'
  ),

  yourUniqueReference: Joi.string(),

  otherReferencesForMovement: Joi.array().items(otherReferenceForMovement),

  specialHandlingRequirements: Joi.string().max(5000),

  producer: producerDetails.required(),

  carrier: creationCarrierDetails.required(),

  brokerOrDealer,

  receiver: creationReceiverDetails,

  wasteItems: Joi.array()
    .items(
      wasteItem.concat(
        Joi.object({
          disposalOrRecoveryCodes: Joi.array()
            .items(Joi.string())
            .min(1)
            .required()
        })
      )
    )
    .min(1)
    .required(),

  isDeleted: Joi.boolean().default(false)
})
  // A create request may not soft-delete the Movement.
  .custom((value, helpers) => {
    if (value.isDeleted === true) {
      return helpers.error('any.invalid', {
        message: 'isDeleted must not be true when creating a Movement'
      })
    }

    const hasConsignmentCode = value.hazardousWasteConsignmentCode !== undefined

    const hasReason = value.reasonForNoConsignmentCode !== undefined

    if (hasConsignmentCode && hasReason) {
      return helpers.error('any.invalid', {
        message:
          'hazardousWasteConsignmentCode and reasonForNoConsignmentCode are mutually exclusive'
      })
    }

    return value
  })

// -----------------------------------------------------------------------------
// Collection
// -----------------------------------------------------------------------------

const collectionRequest = Joi.object({
  apiCode: uuid.required(),

  actualDateTimeCollected: isoDateTime.required(),

  collectionType: Joi.string().valid('STATIC', 'TRANSIT').default('STATIC'),

  yourUniqueReference: Joi.string(),

  otherReferencesForMovement: Joi.array().items(otherReferenceForMovement),

  carrier: carrier.required(),

  receivedFromCarrier: carrier,

  brokerOrDealer,

  collection: collectionSite.required(),

  isDeleted: Joi.boolean().default(false)
}).custom((value, helpers) => {
  if (value.isDeleted === true) {
    return helpers.error('any.invalid', {
      message: 'isDeleted must not be true when recording a collection'
    })
  }

  if (value.collectionType === 'TRANSIT' && !value.receivedFromCarrier) {
    return helpers.error('any.invalid', {
      message: 'receivedFromCarrier is required for a TRANSIT collection'
    })
  }

  if (
    value.collectionType === 'STATIC' &&
    value.receivedFromCarrier !== undefined
  ) {
    return helpers.error('any.invalid', {
      message:
        'receivedFromCarrier must not be supplied for a STATIC collection'
    })
  }

  return value
})

// -----------------------------------------------------------------------------
// Drop-off
// -----------------------------------------------------------------------------

const dropOffRequest = Joi.object({
  apiCode: uuid.required(),

  movementIds: Joi.array().items(movementId).min(1).required(),

  actualDateTimeDropOff: isoDateTime.required(),

  yourUniqueReference: Joi.string(),

  otherReferencesForMovement: Joi.array().items(otherReferenceForMovement),

  carrier: carrier.required(),

  dropOff: dropOffSite.required(),

  isDeleted: Joi.boolean().default(false)
}).custom((value, helpers) => {
  if (value.isDeleted === true) {
    return helpers.error('any.invalid', {
      message: 'isDeleted must not be true when creating a drop-off'
    })
  }

  /*
   * The hazardous aggregation rule cannot be implemented here because
   * hazardous/non-hazardous status belongs to the referenced Movements,
   * not to this request body.
   *
   * Service-layer rule:
   *
   *   if ANY movement is hazardous:
   *       movementIds.length === 1
   *
   * This is explicitly data-dependent in the OpenAPI specification.
   */

  return value
})

// Only apiCode + isDeleted are allowed on PUT /transfers/{transferId}.
const dropOffUpdateRequest = Joi.object({
  apiCode: uuid.required(),
  isDeleted: Joi.boolean().required()
}).unknown(false)

// -----------------------------------------------------------------------------
// Phase 1 receipt
// -----------------------------------------------------------------------------

const hazardousWasteConsignmentCode = Joi.string().pattern(
  /^(?:[A-Za-z0-9]{6}\/[A-Za-z0-9]{5}|S[ABC]\d{7}|D[ABC]\d{7})$/
)

const receiveMovementRequest = Joi.object({
  apiCode: uuid.required(),

  dateTimeReceived: isoDateTime.required(),

  hazardousWasteConsignmentCode,

  reasonForNoConsignmentCode: Joi.string().valid(
    'Non-Haz Waste Transfer',
    'No documentation provided with Waste',
    'Household Waste Recycling Centre Receipt'
  ),

  yourUniqueReference: Joi.string(),

  otherReferencesForMovement: Joi.array().items(otherReferenceForMovement),

  specialHandlingRequirements: Joi.string().max(5000),

  wasteItems: Joi.array().items(wasteItem).min(1).required(),

  carrier: carrier.required(),

  brokerOrDealer,

  receiver: receiver.required(),

  receipt: receipt.required()
}).custom((value, helpers) => {
  const hasCode = value.hazardousWasteConsignmentCode !== undefined

  const hasReason = value.reasonForNoConsignmentCode !== undefined

  if (hasCode && hasReason) {
    return helpers.error('any.invalid', {
      message:
        'hazardousWasteConsignmentCode and reasonForNoConsignmentCode are mutually exclusive'
    })
  }

  return value
})

// -----------------------------------------------------------------------------
// Responses
// -----------------------------------------------------------------------------

const createMovementResponse = Joi.object({
  movementId,

  validation: validationEnvelope
})

const updateResponse = Joi.object({
  validation: validationEnvelope
})

const recordCollectionResponse = Joi.object({
  validation: validationEnvelope,

  movementResource: Joi.any()
})

const dropOffResponse = Joi.object({
  transferId,

  validation: validationEnvelope
})

const receiptResponse = Joi.object({
  validation: validationEnvelope
})

const movementResource = Joi.object({
  movementId: movementId.required()
}).concat(createMovementRequest)

const dropOffResource = Joi.object({
  transferId: transferId.required()
}).concat(dropOffRequest)

const receiptResource = Joi.object({
  transferId: transferId.required()
}).concat(receiveMovementRequest)

const notFoundError = Joi.object({
  code: Joi.string()
    .valid(
      'MOVEMENT_NOT_FOUND',
      'COLLECTION_NOT_RECORDED',
      'TRANSFER_NOT_FOUND',
      'RECEIPT_NOT_RECORDED'
    )
    .required(),

  message: Joi.string()
})

// -----------------------------------------------------------------------------
// Useful endpoint-level aliases
// -----------------------------------------------------------------------------

const endpoints = {
  createMovement: createMovementRequest,

  updateMovement: createMovementRequest,

  recordCollection: collectionRequest,

  updateCollection: collectionRequest,

  recordDropOff: dropOffRequest,

  updateDropOff: dropOffUpdateRequest,

  recordReceipt: receiveMovementRequest,

  updateReceipt: receiveMovementRequest,

  // Deprecated Phase 1 endpoint
  createReceiptMovementLegacy: receiveMovementRequest,

  // Deprecated Phase 1 update
  updateReceiptMovementLegacy: receiveMovementRequest
}

// -----------------------------------------------------------------------------
// Public exports
// -----------------------------------------------------------------------------

export {
  // primitives
  uuid,
  isoDateTime,
  movementId,
  transferId,
  wasteTrackingId,
  weight,

  // common
  address,
  addressWithFullAddress,
  receiptAddress,
  organisation,
  otherReferenceForMovement,
  validationResult,
  validationEnvelope,
  validationErrorEnvelope,

  // parties
  producerDetails,
  creationCarrierDetails,
  carrier,
  brokerOrDealer,
  creationReceiverDetails,
  receiver,

  // sites
  collectionSite,
  dropOffSite,
  driverDetails,
  receipt,

  // waste classification
  popComponent,
  pops,
  hazardousComponent,
  hazardous,
  disposalOrRecoveryCode,
  wasteItem,

  // requests
  createMovementRequest,
  collectionRequest,
  dropOffRequest,
  dropOffUpdateRequest,
  receiveMovementRequest,

  // responses
  createMovementResponse,
  updateResponse,
  recordCollectionResponse,
  dropOffResponse,
  receiptResponse,
  movementResource,
  dropOffResource,
  receiptResource,
  notFoundError,

  // endpoint lookup
  endpoints
}
