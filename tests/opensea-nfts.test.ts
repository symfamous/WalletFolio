import test from "node:test";
import assert from "node:assert/strict";
import { screenOpenSeaNfts } from "../lib/providers/opensea.ts";

function evidence(
  name: string,
  safelistStatus: string,
  floorPrice: number,
  symbol = "ETH",
  unitUsd = "2000"
) {
  return {
    collection: {
      collection: name.toLowerCase(),
      name,
      image_url: "https://img.example/collection.png",
      opensea_url: `https://opensea.io/collection/${name.toLowerCase()}`,
      safelist_status: safelistStatus,
      is_disabled: false,
      is_nsfw: false,
      pricing_currencies: {
        listing_currency: { symbol, usd_price: unitUsd },
      },
    },
    stats: {
      total: { floor_price: floorPrice, floor_price_symbol: symbol },
    },
  };
}

function nft(collection: string, name: string) {
  return {
    identifier: "1",
    collection,
    contract: "0xabc",
    chain: "ethereum",
    name,
    display_image_url: "https://img.example/nft.png",
    opensea_url: `https://opensea.io/assets/ethereum/0xabc/1`,
    is_disabled: false,
    is_nsfw: false,
  };
}

test("NFT screening shows only verified recognizable collections above ten dollars", () => {
  const evidenceMap = new Map([
    ["valuable", evidence("Valuable", "verified", 0.02)],
    ["cheap", evidence("Cheap", "verified", 0.004)],
    ["unknown", evidence("Unknown", "not_requested", 1)],
  ]);

  const result = screenOpenSeaNfts([
    nft("valuable", "Valuable #1"),
    nft("cheap", "Cheap #1"),
    nft("unknown", "Unknown #1"),
  ], evidenceMap);

  assert.equal(result.length, 1);
  assert.equal(result[0].collectionName, "Valuable");
  assert.equal(result[0].estimatedValueUsd, 40);
});

test("NFT screening rejects verified OAT and attendance-style assets", () => {
  const evidenceMap = new Map([
    ["event-oat", evidence("Event OAT", "verified", 1, "USDC", "1")],
  ]);

  const result = screenOpenSeaNfts([nft("event-oat", "Conference OAT")], evidenceMap);
  assert.deepEqual(result, []);
});

test("NFT screening uses stable-denominated floors without external price data", () => {
  const evidenceMap = new Map([
    ["collectible", evidence("Collectible", "verified", 14, "USDC", "0")],
  ]);

  const result = screenOpenSeaNfts([nft("collectible", "Collectible #1")], evidenceMap);
  assert.equal(result[0].estimatedValueUsd, 14);
});
