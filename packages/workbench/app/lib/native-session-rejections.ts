// Shared only in this page's memory. Never persist or log session tokens.
const rejectedTokens = new Set<string>();

export function isRejectedSessionToken(token: string): boolean {
  return rejectedTokens.has(token);
}

export function rejectSessionToken(token: string): void {
  rejectedTokens.add(token);
}
