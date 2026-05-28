export class RenderInterface {
  constructor(
    public enabled: boolean,
    public rendererType: string,
    public publishRender: boolean,
  ) {}

  toXml(indent = 0): string {
    const pad = "  ".repeat(indent);
    const inner = "  ".repeat(indent + 1);
    return [
      `${pad}<render_interface>`,
      `${inner}<publish_render>${this.enabled}</publish_render>`,
      `${inner}<renderer_type_name>${this.rendererType}</renderer_type_name>`,
      `${pad}</render_interface>`,
    ].join("\n");
  }
}
