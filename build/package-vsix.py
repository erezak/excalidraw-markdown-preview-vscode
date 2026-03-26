from __future__ import annotations

import json
from pathlib import Path
from xml.sax.saxutils import escape
from zipfile import ZIP_DEFLATED, ZipFile


ROOT = Path(__file__).resolve().parent.parent


CONTENT_TYPES = {
    '.json': 'application/json',
    '.js': 'application/javascript',
    '.md': 'text/markdown',
    '.txt': 'text/plain',
    '.map': 'application/json',
    '.svg': 'image/svg+xml',
    '.css': 'text/css',
    '.html': 'text/html',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.xml': 'application/xml',
    '.vsixmanifest': 'text/xml',
}


def load_manifest() -> dict:
    return json.loads((ROOT / 'package.json').read_text())


def iter_files(manifest: dict) -> list[Path]:
    included: set[Path] = set()

    for pattern in manifest.get('files', []):
        for match in ROOT.glob(pattern):
            if match.is_file():
                included.add(match.resolve())

    for required_name in ('package.json', 'README.md', 'CHANGELOG.md'):
        required_path = ROOT / required_name
        if required_path.exists():
            included.add(required_path.resolve())

    return sorted(included)


def relative_extension_path(file_path: Path) -> str:
    return f"extension/{file_path.relative_to(ROOT).as_posix()}"


def build_manifest_xml(manifest: dict) -> str:
    publisher = escape(manifest['publisher'])
    name = escape(manifest['name'])
    version = escape(manifest['version'])
    display_name = escape(manifest.get('displayName', manifest['name']))
    description = escape(manifest.get('description', ''))
    engine = escape(manifest['engines']['vscode'])
    keywords = ','.join(manifest.get('keywords', []))
    categories = ','.join(manifest.get('categories', []))

    assets = [
        '<Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true" />',
    ]

    if (ROOT / 'README.md').exists():
        assets.append('<Asset Type="Microsoft.VisualStudio.Services.Content.Details" Path="extension/README.md" Addressable="true" />')

    if (ROOT / 'CHANGELOG.md').exists():
        assets.append('<Asset Type="Microsoft.VisualStudio.Services.Content.Changelog" Path="extension/CHANGELOG.md" Addressable="true" />')

    return f'''<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011">
  <Metadata>
    <Identity Language="en-US" Id="{publisher}.{name}" Version="{version}" Publisher="{publisher}" />
    <DisplayName>{display_name}</DisplayName>
    <Description xml:space="preserve">{description}</Description>
    <Tags>{escape(keywords)}</Tags>
    <Categories>{escape(categories)}</Categories>
    <Properties>
      <Property Id="Microsoft.VisualStudio.Code.Engine" Value="{engine}" />
    </Properties>
  </Metadata>
  <Installation>
    <InstallationTarget Id="Microsoft.VisualStudio.Code" Version="{engine}" />
  </Installation>
  <Dependencies />
  <Assets>
    {' '.join(assets)}
  </Assets>
</PackageManifest>
'''


def build_content_types(files: list[Path]) -> str:
    extensions = {'.xml', '.vsixmanifest'}
    for file_path in files:
        extensions.add(file_path.suffix.lower())

    defaults = []
    for extension in sorted(extensions):
        clean_extension = extension.lstrip('.')
        defaults.append(
            f'<Default Extension="{clean_extension}" ContentType="{CONTENT_TYPES.get(extension, "application/octet-stream")}" />'
        )

    return f'''<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  {' '.join(defaults)}
</Types>
'''


def main() -> None:
    manifest = load_manifest()
    files = iter_files(manifest)
    output_path = ROOT / f"{manifest['name']}-{manifest['version']}.vsix"

    if output_path.exists():
        output_path.unlink()

    with ZipFile(output_path, 'w', compression=ZIP_DEFLATED) as archive:
        archive.writestr('[Content_Types].xml', build_content_types(files))
        archive.writestr('extension.vsixmanifest', build_manifest_xml(manifest))

        for file_path in files:
            archive.write(file_path, relative_extension_path(file_path))

    print(output_path.name)


if __name__ == '__main__':
    main()