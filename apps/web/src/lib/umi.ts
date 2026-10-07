"use client";

import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { mplCore, fetchAsset, fetchAssetsByOwner, type AssetV1 } from "@metaplex-foundation/mpl-core";
import { publicKey as umiPublicKey } from "@metaplex-foundation/umi";
import { PUBLIC_ENV } from "@/lib/env";
import { Connection } from "@solana/web3.js";
import { createThrottledFetch } from "@/lib/rpcFetch";

let umi: ReturnType<typeof createUmi> | null = null;
export function getUmi() {
  if (!umi) umi = createUmi(new Connection(PUBLIC_ENV.rpcUrl, { commitment: "confirmed", fetch: createThrottledFetch(6) })).use(mplCore());
  return umi;
}

export type CoreAssetView = {
  address: string;
  name: string;
  uri: string;
  owner: string;
  updateAuthority: string;
  collection: string | null;
  attributes: Array<{ key: string; value: string }>;
  royaltiesBps: number | null;
};

export function toAssetView(asset: AssetV1): CoreAssetView {
  const ua = asset.updateAuthority as { type?: string; address?: string } | undefined;
  return {
    address: asset.publicKey.toString(),
    name: asset.name,
    uri: asset.uri,
    owner: asset.owner.toString(),
    updateAuthority: ua?.address ? String(ua.address) : ua?.type ?? "",
    collection: ua?.type === "Collection" && ua.address ? String(ua.address) : null,
    attributes: asset.attributes?.attributeList?.map((a) => ({ key: a.key, value: a.value })) ?? [],
    royaltiesBps: asset.royalties ? Number(asset.royalties.basisPoints) : null,
  };
}

export async function fetchCoreAsset(address: string): Promise<CoreAssetView | null> {
  try {
    const asset = await fetchAsset(getUmi(), umiPublicKey(address), { skipDerivePlugins: false });
    return toAssetView(asset);
  } catch {
    return null;
  }
}

export async function fetchCoreAssetsByOwner(owner: string): Promise<CoreAssetView[]> {
  try {
    const assets = await fetchAssetsByOwner(getUmi(), umiPublicKey(owner), { skipDerivePlugins: false });
    return assets.map(toAssetView);
  } catch {
    return [];
  }
}
