export type ClaudeErrorCode = 'unauthorized' | 'rate_limited' | 'http' | 'network' | 'timeout' | 'bad_response'

export class ClaudeError extends Error {
  code: ClaudeErrorCode
  constructor(code: ClaudeErrorCode, msg: string) {
    super(msg)
    this.name = 'ClaudeError'
    this.code = code
  }
}
