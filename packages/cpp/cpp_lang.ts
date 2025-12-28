import { basename, dirname, extname, join } from "node:path";

import { SourceDirContext } from "../core/context";
import { cachedCmd, cacheInfo } from "../make/cache";
import { build } from "../make/cmd";
import { copyFileSync } from "node:fs";
import { logOutputAction, log } from "@ozibuild/core/log";

/** Represents an output cpp object. */
export interface CppObject {
  /** .o file for the compile cpp. */
  obj: string;
}

/** Compiles a single c++ source to object.
 *
 * @param ctx {SourceDirContext} source directory context. `cpp.includes` and `cpp.flags` are read from context.
 * @param params.src {string} source file, relative to source directory or absolute
 * @param params.cflags {string[]} compilation flags passed explicitly
 *
 * In addition to explicit cflags,
 * cppCompile uses the cflags from the config relative to the source context,
 * specified through `cpp.cflags` key.
 *
 * Most of the time this function doesn't need to be invoked directly,
 *
 *
 * @returns a promise of the compiled cpp object.
 */
export async function cppCompile(
  ctx: SourceDirContext,
  params: {
    src: string;
    deps: string[];
    cflags: string[];
  },
): Promise<CppObject> {
  const obasename = basename(params.src, extname(params.src)) + ".o";
  const obj = ctx.outputFile(obasename);
  const cflagsFromConfig = ctx.config.getOptional("cpp.flags", []) as string[];
  const srcPath = ctx.resolvePath(params.src);
  const cmd = ["g++", "-c", "-o", obj]
    .concat(cflagsFromConfig)
    .concat(params.cflags)
    .concat(srcPath);
  await cachedCmd(
    ctx,
    { file: obj },
    { deps: params.deps.concat([srcPath]), cmd },
  );
  return { obj };
}

/** Represents the output of a compiled c++ library
 * and instructions on how it should be linked.
 */
export interface CppLibrary {
  /** cflags required for compiling against the library, e.g. includes */
  cflags: string[];
  /** ldflags required for linking against the library, e.g. libraries */
  ldflags: string[];
  /** The library archive file (libX.a). */
  lib?: string;
  /** Headers, as absolute path to their sources, which are part of the library */
  hdrs?: string[];
  /** Shared libraries that are part of the library. */
  sharedLibs?: string[];
}

function selectIncludes(ctx: SourceDirContext): string[] {
  return ctx.config.getOptional("cpp.include", []) as string[];
}

/** Builds a static library from C++ source files.
 *
 * @param ctx {SourceDirContext} source directory context
 * @param lib
 * @param srcs
 * @param deps
 * @returns
 */
export async function cppLibrary(
  ctx: SourceDirContext,
  lib: string,
  params: {
    hdrs?: string[];
    srcs: string[];
    deps?: Promise<CppLibrary>[];
  },
): Promise<CppLibrary> {
  const outdir = ctx.outputPath(true);
  const outlib = join(outdir, `lib${lib}.a`);
  const hdrs = (params.hdrs || []).map((hdr) => ctx.resolvePath(hdr));
  return Promise.all(params.deps || []).then((resolvedDeps) => {
    const includes = selectIncludes(ctx);
    const cflags = dedupe(
      resolvedDeps
        .flatMap((dep) => dep.cflags)
        .concat(includes.map((include) => `-I${include}`)),
    );
    const hdrDeps = dedupe(
      hdrs.concat(resolvedDeps.flatMap((dep) => dep.hdrs || [])),
    );
    const objs = params.srcs.map((src) =>
      cppCompile(ctx, { src, deps: hdrDeps, cflags }),
    );
    return Promise.all(objs).then((resolvedObjs) => {
      const objs = resolvedObjs.map((resolvedObj) => resolvedObj.obj);
      const cmd = ["ar", "rcs", outlib].concat(objs);
      return cachedCmd(
        ctx,
        { file: outlib },
        { deps: objs, cwd: outdir, cmd },
      ).then(() => ({
        hdrs,
        cflags,
        ldflags: [`-L${outdir}`, `-l${lib}`].concat(
          dedupe(resolvedDeps.flatMap((dep) => dep.ldflags)),
        ),
        lib: outlib,
      }));
    });
  });
}

/** Provides a headers only library from C++ source headers.
 *
 * @param ctx {SourceDirContext} source directory context
 * @param deps
 * @returns
 */
export async function cppHeadersLibrary(
  ctx: SourceDirContext,
  params: {
    include: string;
    hdrs?: string[];
    deps?: Promise<CppLibrary>[];
  },
): Promise<CppLibrary> {
  if (params.deps) {
    await Promise.all(params.deps);
  }
  return {
    hdrs: (params.hdrs || []).map((hdr) => ctx.resolvePath(hdr)),
    cflags: [`-I${ctx.resolvePath(params.include)}`],
    ldflags: [],
  };
}

export interface CppBinary {
  bin: string;
  sharedLibs?: string[];
}

export async function cppBinary(
  ctx: SourceDirContext,
  bin: string,
  params: {
    srcs: string[];
    deps?: Promise<CppLibrary>[];
  },
): Promise<CppBinary> {
  const outdir = ctx.outputPath(true);
  const outbin = join(outdir, bin);
  return Promise.all(params.deps || []).then((resolvedDeps) => {
    const cflags = dedupe(resolvedDeps.flatMap((dep) => dep.cflags));
    const hdrDeps = dedupe(resolvedDeps.flatMap((dep) => dep.hdrs || []));
    const objs = params.srcs.map((src) =>
      cppCompile(ctx, { src, deps: hdrDeps, cflags }),
    );
    const sharedLibs = dedupe(
      resolvedDeps.flatMap((dep) => dep.sharedLibs || []),
    );
    return Promise.all(objs).then((resolvedObjs) => {
      const objs = resolvedObjs.map((resolvedObj) => resolvedObj.obj);
      const ldflags = dedupe(
        resolvedDeps
          .flatMap((resolvedDep) => resolvedDep.ldflags)
          .concat(ctx.config.getOptional("cpp.ldflags", [])),
      );
      const cmd = ["g++", "-o", outbin].concat(objs).concat(ldflags);
      const depLibs = resolvedDeps
        .map((resolvedDep) => resolvedDep.lib)
        .filter((lib) => lib != null);
      return cachedCmd(
        ctx,
        { file: outbin },
        { deps: objs.concat(depLibs), cmd },
      ).then(() => ({ bin: outbin, sharedLibs }));
    });
  });
}

export async function cppTest(
  ctx: SourceDirContext,
  bin: string,
  params: {
    srcs: string[];
    deps?: Promise<CppLibrary>[];
    data?: string[];
  },
): Promise<CppBinary> {
  return cppBinary(ctx, bin, params).then((test) => {
    const cwd = dirname(test.bin);
    const out = ctx.outputPath(true);
    for (const d of params.data || []) {
      const dOut = join(out, d);
      const dCacheInfo = cacheInfo(ctx, dOut, [d], []);
      if (dCacheInfo.isCacheHit) {
        continue;
      }
      copyFileSync(ctx.resolvePath(d), dOut);
      dCacheInfo.save();
    }
    logOutputAction(test.bin, "testing...", { cwd });
    return build(
      ctx,
      { label: basename(test.bin) },
      {
        cmd: [test.bin],
        cwd: ctx.outputPath(false),
        env: {
          LD_PRELOAD: (test.sharedLibs || []).join(":"),
        },
      },
    ).then((out) => {
      log(out);
      return test;
    });
  });
}

/** Given a list of string, keeps only first occurence of duplicate values. */
function dedupe(a: string[]): string[] {
  const s = new Map();
  a.forEach((e) => s.set(e, (s.get(e) || 0) + 1));
  return a.filter((e) => {
    const c = s.get(e) - 1;
    s.set(e, c);
    return c === 0;
  });
}
