import { sketchfabProvider } from "./sketchfab.js";
import { myMiniFactoryProvider } from "./myminifactory.js";
import { cgtraderProvider } from "./cgtrader.js";
import { cultsProvider } from "./cults.js";
import { thingiverseProvider } from "./thingiverse.js";
import { nasaProvider } from "./nasa.js";
import { smithsonianProvider } from "./smithsonian.js";

import { printablesLinkProvider } from "./printables.js";
import { thangsLinkProvider } from "./thangs.js";
import { turbosquidLinkProvider } from "./turbosquid.js";
import { makerworldLinkProvider } from "./makerworld.js";
import { openbuildsLinkProvider } from "./openbuilds.js";
import { vectricLinkProvider } from "./vectric.js";
import { easelLinkProvider } from "./easel.js";
import { glowforgeLinkProvider } from "./glowforge.js";
import { xtoolLinkProvider } from "./xtool.js";

export function getProviders() {
  const list = [
    sketchfabProvider(),
    myMiniFactoryProvider(),
    cgtraderProvider(),
    cultsProvider(),
    thingiverseProvider(),
    nasaProvider(),
    smithsonianProvider(),
    printablesLinkProvider(),
    thangsLinkProvider(),
    makerworldLinkProvider(),
    turbosquidLinkProvider(),
    openbuildsLinkProvider(),
    vectricLinkProvider(),
    easelLinkProvider(),
    glowforgeLinkProvider(),
    xtoolLinkProvider(),
  ];
  return Object.fromEntries(list.map((provider) => [provider.id, provider]));
}
