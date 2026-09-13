"""Build self-contained ZIPs from an explicit file list and checksum-pinned Node.

Maintainer tool only; end users need neither Python nor a system Node install.
"""
import argparse
import hashlib
import io
import json
from pathlib import Path
import shutil
import tarfile
import tempfile
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parent.parent
VERSION = json.loads((ROOT / 'package.json').read_text())['version']
NODE = 'v24.21.0'
PINS = {
    'windows-x64': ('win-x64/node.exe', 'ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32'),
    'macos-arm64': (f'node-{NODE}-darwin-arm64.tar.gz', 'bed7eea5325e1108f32ce5228ddd6a5f0f08a499ee42aa7442aea583702f6057'),
    'macos-x64': (f'node-{NODE}-darwin-x64.tar.gz', '1462cb3b3046b815cf8ea436d3da450ec1a9f11dac7e5a46b0ada5305d7e8097'),
}

def digest(data):
    return hashlib.sha256(data).hexdigest()

def normalize_text(folder):
    # Packages built on Windows must contain runnable Unix scripts too.
    extensions = {'.md', '.js', '.json', '.yaml', '.yml', '.py', '.svg', '.sh', '.command', '.txt', '.sha256'}
    for path in folder.rglob('*'):
        if path.is_file() and (path.suffix in extensions or path.name in ('soft-landing', 'LICENSE', '.gitignore', '.gitattributes')):
            path.write_bytes(path.read_bytes().replace(b'\r\n', b'\n'))

def download(path, expected):
    cache = ROOT / 'artifacts' / 'downloads' / path.replace('/', '_')
    cache.parent.mkdir(parents=True, exist_ok=True)
    if cache.exists() and digest(cache.read_bytes()) == expected:
        return cache.read_bytes()
    with urllib.request.urlopen(f'https://nodejs.org/dist/{NODE}/{path}', timeout=120) as response:
        data = response.read()
    if digest(data) != expected:
        raise ValueError(f'Node checksum mismatch: {path}')
    cache.write_bytes(data)
    return data

def add_runtime(target, platform):
    target.mkdir(parents=True)
    path, expected = PINS[platform]
    data = download(path, expected)
    if platform == 'windows-x64':
        binary, name = data, 'node.exe'
        # Extract the license from a checksum-verified release archive too.
        license_path, license_pin = PINS['macos-arm64']
        archive = download(license_path, license_pin)
    else:
        archive, name = data, 'node'
    with tarfile.open(fileobj=io.BytesIO(archive), mode='r:gz') as tar:
        license_member = next(m for m in tar.getmembers() if m.name.endswith('/LICENSE') and m.name.count('/') == 1)
        (target / 'LICENSE').write_bytes(tar.extractfile(license_member).read())
        if platform != 'windows-x64':
            node_member = next(m for m in tar.getmembers() if m.name.endswith('/bin/node') and m.isfile())
            binary = tar.extractfile(node_member).read()
    (target / name).write_bytes(binary)
    (target / name).chmod(0o755)
    (target / 'runtime.json').write_text(json.dumps({'version': NODE, 'sha256': digest(binary), 'source': f'https://nodejs.org/dist/{NODE}/{path}', 'archiveSha256': expected}, indent=2) + '\n')
    (target / 'node.sha256').write_text(f'{digest(binary)}  {name}\n')
    if platform != 'windows-x64':
        (target / 'arch.txt').write_text('arm64\n' if platform.endswith('arm64') else 'x86_64\n')

def write_zip(folder, destination):
    with zipfile.ZipFile(destination, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for path in sorted(folder.rglob('*')):
            if not path.is_file():
                continue
            rel = path.relative_to(folder.parent).as_posix()
            info = zipfile.ZipInfo(rel, date_time=(2026, 9, 10, 0, 0, 0))
            info.create_system = 3
            executable = path.name in ('node', 'soft-landing') or path.suffix in ('.sh', '.command')
            info.external_attr = (0o100755 if executable else 0o100644) << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, path.read_bytes())
    destination.with_suffix(destination.suffix + '.sha256').write_text(f'{digest(destination.read_bytes())}  {destination.name}\n')
    print(destination, flush=True)

def build(platform, out):
    name = f'soft-landing-{VERSION}-{platform}'
    with tempfile.TemporaryDirectory(prefix='landing-build-') as temp:
        stage = Path(temp) / name
        stage.mkdir()
        shutil.copytree(ROOT / 'packaging/soft-landing', stage / 'soft-landing')
        app = stage / 'soft-landing/skills/soft-landing/app'
        app.mkdir()
        shutil.copytree(ROOT / 'src', app / 'src')
        for file in ('package.json', 'soft-landing.example.json', 'LICENSE'):
            shutil.copy2(ROOT / file, app / file)
        add_runtime(app / 'runtime', platform)
        if platform == 'windows-x64':
            for file in ('INSTALL.cmd', 'install.ps1'):
                shutil.copy2(ROOT / 'packaging' / file, stage / file)
            shutil.copy2(ROOT / 'packaging/Start-Soft-Landing.ps1', app)
        else:
            for file in ('INSTALL.command', 'install.sh'):
                shutil.copy2(ROOT / 'packaging' / file, stage / file)
            shutil.copy2(ROOT / 'packaging/Start-Soft-Landing.command', app)
            shutil.copy2(ROOT / 'packaging/soft-landing.sh', app / 'soft-landing')
        for file in ('INSTALLATION.md', 'LICENSE', 'README.md'):
            shutil.copy2(ROOT / file, stage / file)
        for file in ('SECURITY.md', 'CHANGELOG.md', 'CONTRIBUTING.md'):
            shutil.copy2(ROOT / file, stage / file)
        shutil.copytree(ROOT / 'docs', stage / 'docs')
        normalize_text(stage)
        # Machine-readable provenance for every shipped source and binary.
        manifest = {p.relative_to(stage).as_posix(): digest(p.read_bytes()) for p in sorted(stage.rglob('*')) if p.is_file()}
        (stage / 'CONTENTS.sha256.json').write_text(json.dumps(manifest, indent=2) + '\n')
        write_zip(stage, out / (name + '.zip'))

def source(out):
    with tempfile.TemporaryDirectory(prefix='landing-source-') as temp:
        stage = Path(temp) / f'soft-landing-{VERSION}-source'
        stage.mkdir()
        for name in ('src', 'test', 'scripts', 'docs', 'packaging', '.github', 'AGENTS.md', 'README.md', 'INSTALLATION.md', 'LICENSE', 'CHANGELOG.md', 'CONTRIBUTING.md', 'SECURITY.md', 'package.json', 'soft-landing.ps1', 'soft-landing.example.json', 'task.example.md', '.gitignore', '.gitattributes'):
            path = ROOT / name
            if path.is_dir():
                shutil.copytree(path, stage / name, ignore=shutil.ignore_patterns('__pycache__', '*.pyc'))
            else:
                shutil.copy2(path, stage / name)
        normalize_text(stage)
        write_zip(stage, out / (stage.name + '.zip'))

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--platform', choices=[*PINS, 'all', 'source'], default='all')
    args = parser.parse_args()
    out = ROOT / 'dist'
    out.mkdir(exist_ok=True)
    for platform in PINS if args.platform == 'all' else ([] if args.platform == 'source' else [args.platform]):
        build(platform, out)
    if args.platform in ('all', 'source'):
        source(out)
