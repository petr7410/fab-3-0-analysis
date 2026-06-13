import re
from datetime import datetime

def parse_decks_file(file_path):
    """
    Parses the decks.txt file and returns a list of deck objects.
    """
    with open(file_path, 'r', encoding='utf-8') as file:
        lines = file.readlines()

    decks = []
    current_deck = None
    current_date = None
    in_equipment_section = False

    date_pattern = re.compile(r"^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}")
    pattern = re.compile(r"^(\d+)x\s+(.+)$")

    for line in lines:
        line = line.strip()
        if not line:
            continue

        if date_pattern.match(line):
            try:
                current_date = datetime.strptime(line[:19], '%Y-%m-%d %H:%M:%S')
                continue
            except ValueError:
                pass

        if line.startswith("Hero: "):
            hero = line.replace("Hero: ", "").strip()
            current_deck = {
                "hero": hero,
                "date": current_date.isoformat() if current_date else None,
                "cards": [],
                "equips": []
            }
            decks.append(current_deck)
            continue

        if line.startswith("Arena cards"):
            in_equipment_section = True
            continue

        if line.startswith("Deck cards"):
            in_equipment_section = False
            continue

        match = pattern.match(line)
        if match and current_deck:
            count = int(match.group(1))
            card_name = match.group(2).strip()
            
            if in_equipment_section:
                current_deck["equips"].append((count, card_name))
            else:
                current_deck["cards"].append((count, card_name))

    return decks
