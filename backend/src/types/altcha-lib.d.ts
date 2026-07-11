declare module 'altcha/lib' {
  export type ChallengeParameters = {
    algorithm: string
    cost: number
    data?: Record<string, boolean | null | number | string>
    expiresAt?: number
    keyLength: number
    keyPrefix: string
    keySignature?: string
    memoryCost?: number
    nonce: string
    parallelism?: number
    salt: string
  }

  export type Challenge = {
    parameters: ChallengeParameters
    signature?: string
  }

  export type Solution = {
    counter: number
    derivedKey: string
    time: number
  }

  export type DeriveKeyFunctionResult = {
    derivedKey: Uint8Array
    parameters?: Partial<ChallengeParameters>
  }

  export type DeriveKeyFunction = (
    parameters: ChallengeParameters,
    salt: Uint8Array,
    password: Uint8Array,
  ) => Promise<DeriveKeyFunctionResult>

  export type CreateChallengeOptions = {
    algorithm: string
    cost: number
    data?: Record<string, boolean | null | number | string>
    deriveKey: DeriveKeyFunction
    expiresAt?: number | Date
    hmacSignatureSecret?: string
    keyLength?: number
    keyPrefixLength?: number
  }

  export type VerifySolutionResult = {
    expired: boolean
    invalidSignature: boolean | null
    invalidSolution: boolean | null
    time: number
    verified: boolean
  }

  export const sha: {
    deriveKey: DeriveKeyFunction
  }

  export function createChallenge(options: CreateChallengeOptions): Promise<Challenge>

  export function verifySolution(options: {
    challenge: Challenge
    deriveKey: DeriveKeyFunction
    hmacSignatureSecret: string
    solution: Solution
  }): Promise<VerifySolutionResult>
}
