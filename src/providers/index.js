import { sketchfabProvider } from "./sketchfab.js";
import { myMiniFactoryProvider } from "./myminifactory.js";
import { cgtraderProvider } from "./cgtrader.js";
import { cultsProvider } from "./cults.js";
import { thingiverseProvider } from "./thingiverse.js";
import { printablesLinkProvider } from "./printables.js";
import { thangsLinkProvider } from "./thangs.js";
import { turbosquidLinkProvider } from "./turbosquid.js";
import { makerworldLinkProvider } from "./makerworld.js";

export function getProviders() {
  const list = [
    sketchfabProvider(),
    myMiniFactoryProvider(),
    cgtraderProvider(),
    cultsProvider(),
    thingiverseProvider(),
    // Link-only sources (no public search API / tokened APIs not integrated yet)
    printablesLinkProvider(),
    thangsLinkProvider(),
    makerworldLinkProvider(),
    turbosquidLinkProvider(),
  ];
  return Object.fromEntries(list.map((p) => [p.id, p]));
}
