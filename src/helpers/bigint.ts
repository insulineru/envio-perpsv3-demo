export const getAbs = (value: bigint): bigint => {
  return value < 0n ? -value : value;
}

export const ETHER = BigInt(10) ** BigInt(18);
