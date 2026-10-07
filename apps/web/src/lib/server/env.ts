import "server-only";
import path from "node:path";
import { DEVNET_RPC } from "@airspace/shared";

const cwd = () => process.cwd();
const resolveFrom = (p: string | undefined, fallback: string) => path.resolve(/* turbopackIgnore: true */ cwd(), p && p.trim() ? p : fallback);

export const SERVER_ENV = {
  get rpcUrl() {
    return process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_RPC_URL || DEVNET_RPC;
  },
  get mapboxToken() {
    return process.env.MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
  },
  get registrarKeypairPath() {
    return resolveFrom(process.env.REGISTRAR_KEYPAIR_PATH, "../../keys/registrar-keypair.json");
  },
  get sasConfigPath() {
    return resolveFrom(process.env.SAS_CONFIG_PATH, "../../keys/sas-config.json");
  },
  get creDir() {
    return resolveFrom(process.env.CRE_DIR, "../../cre");
  },
  get creBin() {
    return process.env.CRE_BIN || path.join(process.env.HOME || "", ".cre", "bin", "cre");
  },
  get dataDir() {
    return path.resolve(cwd(), ".data");
  },
};
