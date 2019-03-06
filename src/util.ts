export function firstOf<T>(x: T[] | T): T {
  return Array.isArray(x) ? x[0] : x;
}

export function asArray<T>(x: T[] | T): T[] {
  if (x === null || typeof x === 'undefined') {
    return [];
  }

  return Array.isArray(x) ? x : [x];
}

export function dataIsDefinedAtPath(data: any, path: string[]): boolean {
  if (data === null || typeof data === 'undefined') {
    return false;
  } else if (Array.isArray(data)) {
    return data.filter(it => dataIsDefinedAtPath(it, path)).length > 0;
  } else if (path.length === 0) {
    return true;
  } else if (typeof data === 'object') {
    return dataIsDefinedAtPath(data[path[0]], path.slice(1));
  } else {
    return false;
  }
}
