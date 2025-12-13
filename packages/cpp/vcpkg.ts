import { join } from 'node:path';

import { SourceDirContext } from "../core/context";
import { cachedCmd } from '../make/cache';
import { cmd } from '../make/cmd';
import { CppLibrary } from './cpp_lang';
import { SpawnOptions } from 'node:child_process';

export interface VcpkgRoot {
  /** Directory where vcpkg packages are installed. */
  dir: string;
  /** Root of the virtual system is installed, e.g. x64-linux/ */
  system: string;
}

let activeVcpkg: Promise<VcpkgRoot>;
const vcpkgInstalls = new Map<String, Promise<VcpkgRoot>>();

/** Ensures vcpkg files specified in vcpkg.json from the given source directory are installed. */
export async function vcpkgInstall(ctx: SourceDirContext): Promise<VcpkgRoot> {
  const outdir = join(ctx.outputPath(true), 'vcpkg_installed');
  let vcpkgInstallInstance = vcpkgInstalls.get(outdir);
  if (vcpkgInstallInstance == null) {
    if (activeVcpkg) {
      await activeVcpkg;
    }
    const out: VcpkgRoot = {
      dir: outdir,
      system: join(outdir, 'x64-linux'),
    };
    activeVcpkg = vcpkgInstallInstance = cachedCmd(ctx, { file: out.dir }, {
      deps: [ctx.resolvePath('vcpkg.json')],
      cwd: ctx.absolutePath,
      cmd: ['vcpkg', '--x-install-root', out.dir, 'install']
    })
      .then(() => out);
    vcpkgInstalls.set(outdir, vcpkgInstallInstance);
  }
  return vcpkgInstallInstance;
}

/** Runs pkg-info within vcpkg_installed output and returns cpp library flags expressed relative to the given source directory. */
export async function vcpkgPkgConfig(
  ctx: SourceDirContext,
  vcpkgRoot: Promise<VcpkgRoot>,
  module: string)
  : Promise<CppLibrary> {
  return vcpkgRoot.then(vcpkgRoot => {
    const libInfo: CppLibrary = {
      cflags: [],
      ldflags: []
    }
    const pkgConfigOpts: SpawnOptions = {
      cwd: ctx.absolutePath, // Run from source directory to get relative includes and lib dirs
      env: {
        PKG_CONFIG_PATH:
          [join(vcpkgRoot.system, 'lib/pkgconfig/'), join(vcpkgRoot.system, 'share/pkgconfig/')].join(':')
      }
    };
    const cmd1 = cmd('pkg-config', ['--cflags', module], pkgConfigOpts)
      .then(cflags => libInfo.cflags = cflags.split(' ').map(cflag => cflag.trim()).filter(cflag => !!cflag));
    const cmd2 = cmd('pkg-config', ['--libs', module], pkgConfigOpts)
      .then(ldflags => libInfo.ldflags = ldflags.split(' ').map(ldflag => ldflag.trim()).filter(ldflag => !!ldflag));
    return Promise.all([cmd1, cmd2]).then(() => libInfo);
  });
}

function dedupe(a: string[]): string[] {
  const s = new Map();
  a.forEach(e => s.set(e, (s.get(e) || 0) + 1));
  return a.filter(e => {
    const c = s.get(e) - 1;
    s.set(e, c);
    return c === 0;
  });
}

export async function vcpkgCustomLib(
  ctx: SourceDirContext,
  vcpkg: Promise<VcpkgRoot>,
  params: {
    hdrs?: string[],
    includes?: string[],
    cflags?: string[],
    ldflags?: string[]
  }
): Promise<CppLibrary> {
  const vcpkgRoot = await vcpkg;
  const hdrs = (params.hdrs || [])
    .map(hdr => join(vcpkgRoot.system, hdr));
  const includes = dedupe((params.includes || [])
    .map(include => join(vcpkgRoot.system, include))
    .concat(hdrs.map(hdr => `dirname(hdr)`)));
  const cflags = dedupe((params.cflags || [])
    .concat(includes.map(include => `-I${include}`)));
  const ldflags = params.ldflags || [];
  return {
    hdrs,
    cflags,
    ldflags
  };
}

export async function vcpkgHeaderLib(
  ctx: SourceDirContext,
  vcpkg: Promise<VcpkgRoot>,
  hdr: string): Promise<CppLibrary> {
  return vcpkgCustomLib(ctx, vcpkg, { hdrs: [hdr] });
}
