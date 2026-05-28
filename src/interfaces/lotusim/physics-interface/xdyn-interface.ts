import { PhysicsEngineInterface } from "./physics-interface-base";

export class XDynInterface extends PhysicsEngineInterface {
  readonly interfaceType = "xdyn";
  readonly connectionType = "XDynWebSocket";

  constructor(
    public uri: string,
    public thrusters: string[],
  ) {
    super();
  }

  toXMLContent(pad: string): string {
    const lines: string[] = [];
    lines.push(`\${pad}<uri>\${this.uri}</uri>`);
    if (this.thrusters.length > 0) {
      lines.push(`\${pad}<thrusters>`);
      this.thrusters.forEach((name, index) => {
        lines.push(`\${pad}    <thrusters\${index + 1}>\${name}</thrusters\${index + 1}>`);
      });
      lines.push(`\${pad}</thrusters>`);
    }
    return lines.join("\n");
  }
}
