import { keccak256, toBytes, parseUnits, type Hex } from "viem";
import type { Grade } from "./types.js";

/** bytes32 id used on-chain: keccak256(utf8(cardId + ":" + grade)) */
export function catalogId(cardId: string, grade: Grade | string): Hex {
  return keccak256(toBytes(`${cardId}:${grade}`));
}

/** USD price -> 18-decimal fixed point (uint256). */
export function price18(usd: number): bigint {
  return parseUnits(usd.toFixed(6), 18);
}
