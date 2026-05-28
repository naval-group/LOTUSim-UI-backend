export enum DomainType {
  Surface = "SURFACE",
  Underwater = "UNDERWATER",
  Aerial = "AERIAL",
}

/**
 * Abstract base class for all physics engine interfaces.
 * Each interface type (xdyn, uuv_sim, etc.) extends this
 * with its own specific parameters.
 */
export abstract class PhysicsEngineInterface {
  /** Identifier matching the YAML interfaceType field */
  abstract readonly interfaceType: string;

  /** Serialize interface-specific params to XML child elements */
  abstract toXMLContent(indent: string): string;

  /**
   * Full XML block for this interface within a domain element.
   * Subclasses only need to implement toXMLContent().
   */
  toXML(pad: string): string {
    const lines: string[] = [];
    lines.push(`\${pad}<interface_type>\${this.connectionType}</interface_type>`);
    lines.push(this.toXMLContent(pad));
    return lines.join("\n");
  }
}

/**
 * Flexible parameter bag for a domain interface.
 * Accepts any YAML-derived key/value structure, e.g.:
 *   uri: ws://127.0.0.1:12345
 *   thrusters:
 *     - name: propeller
 */
export class InterfaceParams {
  [key: string]: any;

  constructor(init: Record<string, any> = {}) {
    Object.assign(this, init);
  }
}

/**
 * A domain (surface, underwater, aerial) with its interface type and params.
 */
export class DomainConfig {
  constructor(
    public domainType: DomainType,
    public interfaceType: string,
    public interfaceParams: InterfaceParams,
  ) {}

  toXML(indent: number = 0, engine?: PhysicsEngineInterface): string {
    const pad = "    ".repeat(indent);
    const domainName = this.domainType.toLowerCase();
    const lines: string[] = [];
    lines.push(`\${pad}<\${domainName}>`);
    if (engine) {
      lines.push(engine.toXML(`\${pad}    `));
    }
    lines.push(`\${pad}</\${domainName}>`);
    return lines.join("\n");
  }
}

// ─── Physics Interface (container) ──────────────────────────

/**
 * Top-level physics interface holding all domain configurations
 * and the initial domain.
 */
export class PhysicsInterface {
  constructor(
    public initDomain: DomainType,
    public domains: DomainConfig[],
  ) {}

  getDomain(type: DomainType): DomainConfig | undefined {
    return this.domains.find((d) => d.domainType === type);
  }

  toXML(indent: number = 0): string {
    const pad = "    ".repeat(indent);
    const lines: string[] = [];
    lines.push(`\${pad}<physics_engine_interface>`);

    for (const domain of this.domains) {
      lines.push(domain.toXML(indent + 1));
    }

    // init_state — capitalize first letter
    const initState =
      this.initDomain.charAt(0).toUpperCase() + this.initDomain.slice(1).toLowerCase();
    lines.push(`\${pad}    <init_state>\${initState}</init_state>`);

    lines.push(`\${pad}</physics_engine_interface>`);
    return lines.join("\n");
  }
}
