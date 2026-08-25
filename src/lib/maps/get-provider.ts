import type { MapProvider } from "./provider";
import { OpenStreetMapProvider } from "./providers/openstreetmap-provider";

let cached: MapProvider | null = null;

export function getMapProvider(): MapProvider {
  if (!cached) cached = new OpenStreetMapProvider();
  return cached;
}
