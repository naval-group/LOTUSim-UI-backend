export class WaypointFollowerInterface {
  constructor(
    public enabled: boolean,
    public loop: boolean,
    public linearAccelLimit: number,
    public angularAccelLimit: number,
    public angularVelLimit: number,
    public mode: string,
    public waypoints: { lat: number; lng: number }[],
    public line: { direction: number; length: number },
    public circle: { radius: number },
  ) {}

  toXml(indent = 0): string {
    const pad = "  ".repeat(indent);
    const inner = "  ".repeat(indent + 1);
    const lines: string[] = [];

    lines.push(`${pad}<follower>`);
    lines.push(`${inner}<loop>${this.loop}</loop>`);

    if (this.mode === "waypoints") {
      lines.push(
        `${inner}<linear_acceleration_limit>${this.linearAccelLimit}</linear_acceleration_limit>`,
      );
      lines.push(
        `${inner}<angular_acceleration_limit>${this.angularAccelLimit}</angular_acceleration_limit>`,
      );
      lines.push(
        `${inner}<angular_velocity_limit>${this.angularVelLimit}</angular_velocity_limit>`,
      );
      lines.push(`${inner}<waypoints>`);
      for (const wp of this.waypoints) {
        lines.push(`${"  ".repeat(indent + 2)}<waypoint>${wp.lat} ${wp.lng}</waypoint>`);
      }
      lines.push(`${inner}</waypoints>`);
    } else if (this.mode === "line") {
      lines.push(`${inner}<line>`);
      lines.push(`${"  ".repeat(indent + 2)}<direction>${this.line.direction}</direction>`);
      lines.push(`${"  ".repeat(indent + 2)}<length>${this.line.length}</length>`);
      lines.push(`${inner}</line>`);
    } else if (this.mode === "circle") {
      lines.push(`${inner}<circle>`);
      lines.push(`${"  ".repeat(indent + 2)}<radius>${this.circle.radius}</radius>`);
      lines.push(`${inner}</circle>`);
    }

    lines.push(`${pad}</follower>`);
    return lines.join("\n");
  }
}
