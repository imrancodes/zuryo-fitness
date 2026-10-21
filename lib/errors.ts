export class ServiceError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
  }
}

export function isDuplicateKeyError(error: unknown) {
  return (error as { code?: number } | null)?.code === 11000;
}
