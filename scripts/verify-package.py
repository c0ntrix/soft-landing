"""Install and exercise a built release on its native platform, without an account."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import subprocess
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parent.parent
VERSION = json.loads((ROOT / 'package.json').read_text())['version']

def run(args, expected=0, **kwargs):
    result = subprocess.run([str(a) for a in args], capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=60, **kwargs)
    if result.returncode != expected:
        raise AssertionError(f'{args}: exit {result.returncode}\n{result.stdout}\n{result.stderr}')
    return result.stdout

def verify(target, codex_check=False):
    native = 'windows-x64' if os.name == 'nt' else 'macos-arm64' if platform.machine() == 'arm64' else 'macos-x64'
    assert target == native, f'Run {target} package on its native OS/architecture, not {native}'
    archive = ROOT / 'dist' / f'soft-landing-{VERSION}-{target}.zip'
    expected = archive.with_suffix('.zip.sha256').read_text().split()[0]
    assert hashlib.sha256(archive.read_bytes()).hexdigest() == expected
    with tempfile.TemporaryDirectory(prefix='soft landing package ') as tmp:
        base = Path(tmp)
        with zipfile.ZipFile(archive) as zipped:
            for member in zipped.infolist():
                relative = Path(member.filename)
                assert not relative.is_absolute() and '..' not in relative.parts
                zipped.extract(member, base)
                path = base / member.filename
                if os.name != 'nt': path.chmod((member.external_attr >> 16) & 0o777)
                assert not any(part in relative.parts for part in ('.research', 'artifacts', '.soft-landing', 'auth.json', '.git'))
        package = base / archive.stem
        manifest = json.loads((package / 'CONTENTS.sha256.json').read_text())
        actual = {p.relative_to(package).as_posix() for p in package.rglob('*') if p.is_file()}
        assert actual == set(manifest) | {'CONTENTS.sha256.json'}
        for name, digest in manifest.items():
            assert hashlib.sha256((package / name).read_bytes()).hexdigest() == digest, name
        skill_root, desktop = base / 'isolated codex' / 'skills', base / 'desktop'
        installed = skill_root / 'soft-landing'
        if os.name == 'nt':
            command = ['powershell.exe', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', package / 'install.ps1', '-SkillRoot', skill_root, '-ShortcutDirectory', desktop, '-NoCheck']
            env = os.environ.copy()
        else:
            command = ['/bin/bash', package / 'install.sh']
            env = dict(os.environ, SOFT_LANDING_SKILL_ROOT=str(skill_root), SOFT_LANDING_SHORTCUT_DIR=str(desktop), SOFT_LANDING_NO_CHECK='1')
        output = run(command, env=env)
        assert 'Installed:' in output
        assert (installed / 'SKILL.md').exists()
        app = installed / 'app'
        node = app / 'runtime' / ('node.exe' if os.name == 'nt' else 'node')
        cli = app / 'src/cli.js'
        assert '0.2.0-beta.1' in run([node, cli, '--help'])
        project = base / 'project with spaces'
        project.mkdir()
        assert 'No Soft Landing tasks' in run([node, cli, 'status', '--cwd', project])
        assert 'SOFT LANDING' in run([node, app / 'src/menu.js'], input='0\n')
        if os.name == 'nt':
            assert (desktop / 'Soft Landing.lnk').exists()
        else:
            assert 'SOFT LANDING' in run(['/bin/bash', desktop / 'Soft Landing.command'], input='0\n')
            assert 'Usage:' in run([app / 'soft-landing', '--help'])
        # An update must not silently overwrite the user's existing installation.
        marker = installed / 'keep-my-file.txt'
        marker.write_text('preserve me')
        run(command, expected=1, env=env)
        assert marker.read_text() == 'preserve me'
        # Report a missing prerequisite as JSON; do not accidentally use runner auth.
        offline = dict(os.environ, CODEX_BIN=str(base / 'missing-codex.exe'))
        result = json.loads(run([node, cli, 'doctor', '--json'], expected=2, env=offline))
        assert result['ok'] is False and result['canStart'] is False
        # Exercise the installed controller via a real stdio process with fake quota.
        run([node, ROOT / 'scripts/package-smoke.js', app, project])
        if codex_check:
            setup = json.loads(run([node, cli, 'doctor', '--json']))
            assert setup['ok'], setup
            run([node, ROOT / 'scripts/verify-skill-discovery.js', app, skill_root.parent, project])
            print('PASS real Codex: setup/account read and installed skill discovery, no model calls')
        print(f'PASS {target}: manifest, install, bundled runtime, menu, status, conflict preservation, doctor, start/resume')

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--platform', required=True, choices=['windows-x64', 'macos-arm64', 'macos-x64'])
    parser.add_argument('--codex-check', action='store_true', help='Also verify a locally signed-in Codex and skill discovery; no model calls')
    args = parser.parse_args()
    verify(args.platform, args.codex_check)
