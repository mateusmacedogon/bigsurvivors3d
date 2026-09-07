from pathlib import Path
import argparse


ROOT = Path(__file__).resolve().parent
PARTS_DIR = ROOT / "parts"
INDEX = ROOT / "index.html"
DEFAULT_OUTPUT = ROOT / "index.generated.html"
PART_FILES = ["part1.html", "part2.js", "part3.js", "part4.js", "part5.js"]


def read_parts():
    missing = [name for name in PART_FILES if not (PARTS_DIR / name).is_file()]
    if missing:
        raise FileNotFoundError("Arquivos ausentes em parts: " + ", ".join(missing))

    content = []
    for name in PART_FILES:
        content.append((PARTS_DIR / name).read_text(encoding="utf-8"))
    return "".join(content)


def main():
    parser = argparse.ArgumentParser(description="Combina os arquivos de parts usando caminhos relativos.")
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help="Arquivo de saida. Padrao: index.generated.html",
    )
    parser.add_argument(
        "--write-index",
        action="store_true",
        help="Permite escrever em index.html somente se o conteudo gerado for identico ao index atual, ou com --force.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Forca a sobrescrita do arquivo de saida. Use com cuidado.",
    )
    args = parser.parse_args()

    output = INDEX if args.write_index else (ROOT / args.output if not args.output.is_absolute() else args.output)
    generated = read_parts()

    if output.resolve() == INDEX.resolve() and INDEX.exists():
        current = INDEX.read_text(encoding="utf-8")
        if current != generated and not args.force:
            safe_output = DEFAULT_OUTPUT
            safe_output.write_text(generated, encoding="utf-8")
            print("parts divergem do index.html atual; index.html preservado.")
            print(f"Arquivo gerado para comparacao: {safe_output.relative_to(ROOT)} ({safe_output.stat().st_size} bytes)")
            print("Use --write-index --force apenas se quiser substituir o jogo atual.")
            return

    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(generated, encoding="utf-8")
    print(f"Arquivo combinado: {output.relative_to(ROOT) if output.is_relative_to(ROOT) else output} ({output.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
