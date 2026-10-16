// (provisório) cofre local do celular
import { Emitter } from "../util/events.js";
export class LocalBackend extends Emitter { constructor() { super(); this.kind = "local"; this.caps = {}; } parearCom() {} async connect() { throw new Error("ainda não disponível"); } }
