export class Memory {
  protected map = new Map<string, Set<any>>();
  protected aliases = new Map<string, string[]>();

  constructor(aliases?: string[][]) {
    if (aliases) {
      for (const keys of aliases) {
        for (const key of keys) {
          this.aliases.set(key, keys);
        }
      }
    }
  }

  public write(path: string[], value: any) {
    if (Array.isArray(value)) {
      value.forEach(item => this.write(path, item));
      return this;
    }

    if (value && typeof value === 'object') {
      Object.keys(value).forEach(key =>
        this.write(path.concat([key]), value[key])
      );
      return this;
    }

    if (value === null || typeof value === 'undefined') {
      return this;
    }

    for (let i = 0; i < path.length; ++i) {
      const p = path
        .slice(i)
        .join('/')
        .toLowerCase();
      const set = this.map.get(p);

      if (!set) {
        this.map.set(p, new Set([value]));
      } else {
        set.add(value);
      }
    }

    return this;
  }

  public read(path: string[]): any[] {
    const result = new Set<any>();

    for (let i = 0; i < path.length; ++i) {
      const aliases = this.getAliases(path[i]);

      for (const key of aliases) {
        const p = [key]
          .concat(path.slice(i + 1))
          .join('/')
          .toLowerCase();
        const set = this.map.get(p);

        if (set) {
          for (const value of set) {
            result.add(value);
          }
        }
      }
    }

    return Array.from(result);
  }

  public getAliases(key: string): string[] {
    return this.aliases.get(key) || [key];
  }

  public serialize() {
    const result: { [key: string]: any[] } = {};
    for (const [path, set] of this.map.entries()) {
      if (path.indexOf('/') === -1) {
        result[path] = Array.from(set);
      }
    }
    return result;
  }
}
