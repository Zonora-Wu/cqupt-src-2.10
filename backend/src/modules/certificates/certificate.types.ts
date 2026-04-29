export type IssueCertificateBody = {
  contribution?: unknown
  publicVerify?: unknown
  vulnerabilityId?: unknown
}

export type RevokeCertificateBody = {
  reason?: unknown
}

export type NormalizedIssueCertificateInput = {
  contribution: string
  publicVerify: boolean
  vulnerabilityId: string
}

export type NormalizedRevokeCertificateInput = {
  reason: string
}

